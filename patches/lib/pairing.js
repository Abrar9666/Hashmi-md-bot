'use strict';
/**
 * lib/pairing.js — HASHMI-MD integrated pairing server.
 *
 * Flow (no external session server needed):
 *   1. User opens /pair and enters a WhatsApp number.
 *   2. POST /api/pair creates a *temporary* Baileys socket and asks
 *      WhatsApp for an 8-character pairing code for that number.
 *   3. User enters the code in WhatsApp > Linked Devices >
 *      "Link with phone number instead".
 *   4. When the temp socket connects, its full auth state is copied
 *      into the main bot session directory, a portable
 *      `Hashmi~<base64-gzip>` SESSION_ID is produced for the page,
 *      and onPaired() fires (the host restarts the bot, which then
 *      boots already-connected from the saved session).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const express = require('express');

function createPairingRouter(options = {}) {
    const sessionDir = options.sessionDir;
    const credsPath = options.credsPath;
    const onPaired = typeof options.onPaired === 'function' ? options.onPaired : () => {};
    const isMainConnected = typeof options.isMainConnected === 'function' ? options.isMainConnected : () => false;
    const log = typeof options.log === 'function' ? options.log : () => {};

    const tmpDir = path.join(__dirname, '..', 'session_pair_tmp');

    let current = {
        status: 'idle', // idle | requesting | code_ready | paired | error
        number: '',
        code: '',
        sessionId: '',
        message: '',
        updatedAt: 0,
    };
    let pairSock = null;

    const setState = (patch) => {
        current = { ...current, ...patch, updatedAt: Date.now() };
    };

    async function startPair(rawNumber) {
        const clean = String(rawNumber || '').replace(/\D/g, '');
        if (clean.length < 10 || clean.length > 15) {
            const err = new Error('Number sahi nahi hai — country code ke saath likho, maslan 923001234567');
            err.statusCode = 400;
            throw err;
        }
        if (isMainConnected() && process.env.PAIR_ALLOW_REPLACE !== 'true') {
            const err = new Error('Bot pehle se WhatsApp se connected hai. Naya number jodne ke liye pehle purani session saaf karo.');
            err.statusCode = 409;
            throw err;
        }
        if (current.status === 'requesting' || (current.status === 'code_ready' && current.number === clean)) {
            return current;
        }

        // Purani temp session saaf karo
        try { if (pairSock) { pairSock.end?.(undefined); pairSock = null; } } catch {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        fs.mkdirSync(tmpDir, { recursive: true });

        setState({ status: 'requesting', number: clean, code: '', sessionId: '', message: 'Pair code manga ja raha hai...' });

        const baileys = require('@whiskeysockets/baileys');
        const { makeWASocket, useMultiFileAuthState, Browsers } = baileys;
        const P = require('pino');

        const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
        if (state.creds.registered) {
            setState({ status: 'error', message: 'Ye number pehle se paired hai. WhatsApp > Linked Devices se purani device hata kar dobara try karo.' });
            throw new Error(current.message);
        }

        let reconnects = 0;
        let requestTries = 0;
        let finished = false;
        const MAX_RECONNECTS = 30;

        async function tryRequestCode(sock) {
            if (finished || state.creds.registered) return;
            requestTries++;
            try {
                const code = await sock.requestPairingCode(clean);
                const formatted = code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
                setState({ status: 'code_ready', code: formatted, message: 'Code mil gaya — WhatsApp mein foran darj karo.' });
                log('INFO', `🔑 Pair code tayyar hai +${clean} ke liye`);
            } catch (e) {
                log('WARN', `Pair code try ${requestTries} fail: ${e.message}`);
                if (requestTries >= 3 && !current.code) {
                    setState({ status: 'error', message: 'Pair code mangne mein masla: ' + e.message + ' — dobara koshish karo.' });
                }
            }
        }

        function launchSocket() {
            const sock = makeWASocket({
                logger: P({ level: 'silent' }),
                printQRInTerminal: false,
                markOnlineOnConnect: false,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                browser: Browsers.ubuntu('Chrome'),
                auth: state,
            });
            pairSock = sock;
            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'open') {
                    finished = true;
                    try {
                        // Poori auth state (creds + keys) main session mein copy karo
                        fs.mkdirSync(sessionDir, { recursive: true });
                        if (fs.existsSync(credsPath)) {
                            try { fs.copyFileSync(credsPath, credsPath + '.backup-' + Date.now()); } catch {}
                        }
                        for (const f of fs.readdirSync(tmpDir)) {
                            try { fs.copyFileSync(path.join(tmpDir, f), path.join(sessionDir, f)); } catch {}
                        }
                        // Portable SESSION_ID banao: Hashmi~<gzip base64 of creds.json>
                        const credsRaw = fs.readFileSync(path.join(tmpDir, 'creds.json'));
                        const sessionId = 'Hashmi~' + zlib.gzipSync(credsRaw).toString('base64');
                        setState({ status: 'paired', code: '', sessionId, message: 'WhatsApp jud gaya! Bot ab restart ho kar online aa jayega.' });
                        log('SUCCESS', `🔗 Pairing mukammal: +${clean} — session main bot mein save ho gayi`);
                        try { sock.end?.(undefined); } catch {}
                        pairSock = null;
                        setTimeout(() => { try { onPaired(); } catch {} }, 1500);
                    } catch (e) {
                        setState({ status: 'error', message: 'Session save karne mein masla: ' + e.message });
                        log('ERROR', `Pairing save error: ${e.message}`);
                    }
                } else if (connection === 'close') {
                    if (pairSock === sock) pairSock = null;
                    try { sock.end?.(undefined); } catch {}
                    try { sock.ws?.close?.(); } catch {}
                    if (finished || current.status === 'paired') return;
                    const sc = lastDisconnect?.error?.output?.statusCode;
                    // Band honay par naya socket sirf tab zinda rehta hai jab code ki registration dobara bheji jaye — warna WhatsApp ~4s mein phir band kar deta hai (logs se sabit: 20 band / 78s)
                    if (sc !== 401 && reconnects < MAX_RECONNECTS && current.status !== 'error') {
                        reconnects++;
                        log('INFO', `Pairing socket band (${sc || '?'}) — dobara jud rahe hain (${reconnects}/${MAX_RECONNECTS})`);
                        setTimeout(() => {
                            try {
                                const s2 = launchSocket();
                                setTimeout(() => tryRequestCode(s2), 1500);
                            } catch (e) { log('WARN', 'Reconnect fail: ' + e.message); }
                        }, 3000);
                    } else if (current.status !== 'error') {
                        setState({ status: 'error', message: `Connection band ho gaya (${sc || 'unknown'}). Dobara koshish karo.` });
                        log('WARN', `Pairing socket closed (final): ${sc}`);
                    }
                }
            });
            return sock;
        }

        const firstSock = launchSocket();
        // Pehli dafa ka azmaya hua tareeqa: socket banne ke 1.5s baad code mango
        setTimeout(() => tryRequestCode(firstSock), 1500);
        return current;
    }

    const router = express.Router();
    router.use(express.json());

    router.get('/pair', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'smm', 'pair.html'));
    });
    router.get('/connect', (req, res) => res.redirect('/pair'));

    router.post('/api/pair', async (req, res) => {
        try {
            const stateNow = await startPair(req.body?.number);
            res.json({ ok: true, number: stateNow.number, code: stateNow.code, status: stateNow.status, message: stateNow.message });
        } catch (e) {
            if (current.status !== 'paired') setState({ status: 'error', message: e.message });
            res.status(e.statusCode || 500).json({ ok: false, status: current.status, message: e.message });
        }
    });

    router.get('/api/pair/status', (req, res) => {
        res.json({
            ok: true,
            status: current.status,
            number: current.number,
            code: current.status === 'code_ready' ? current.code : '',
            sessionId: current.status === 'paired' ? current.sessionId : '',
            message: current.message,
        });
    });

    router.post('/api/pair/reset', (req, res) => {
        try { if (pairSock) { pairSock.end?.(undefined); pairSock = null; } } catch {}
        setState({ status: 'idle', number: '', code: '', sessionId: '', message: '' });
        res.json({ ok: true, status: 'idle' });
    });

    return router;
}

module.exports = { createPairingRouter };
