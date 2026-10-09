'use strict';

const fs      = require('fs');
const path    = require('path');
const config  = require('../config');
const { getStr } = require('../lib/theme');
const { INPUT_COMMANDS } = require('../lib/menu-inputs');
let generateWAMessageFromContent = null;
try { ({ generateWAMessageFromContent } = require('@whiskeysockets/baileys')); } catch {}
const moment  = require('moment-timezone');

const WEBSITE = 'https://abrar-series.vercel.app';
const TZ      = 'Asia/Karachi';

// ── Category definitions ──────────────────────────────────────────────────────
// Each has a numeric ID for `.menu 3` style read-more
const CATEGORIES = [
    { id: 1,  icon: '⬇️',  name: 'Downloaders',        cmds: ['yt','ytmp3','ytmp4','tiktok','instagram','facebook','spotify','soundcloud','capcut','apk','catbox','tourl','pinterest','reddit','twitter','threads','gdrive'] },
    { id: 2,  icon: '🎵',  name: 'Music & Audio',       cmds: ['play','shazam','lyrics','toaudio','bgm','addbgm','setbgm','clearbgm','transcribe','tts'] },
    { id: 3,  icon: '🤖',  name: 'AI & Intelligence',   cmds: ['ai','gpt4','gpt4o','gemini','bard','venice','openai','letmegpt','ask','silva','assistant','imagine','translate','define','calc','shorten','gitclone','anime','manga','describe','caption','carbon'] },
    { id: 4,  icon: '🔍',  name: 'Search & Info',       cmds: ['wiki','country','ip','currency','time','weather','numberfact','stalk','whois','dns','speedtest','ipinfo','screenshot','fetch','githubstalk'] },
    { id: 5,  icon: '🖼️', name: 'Media & Stickers',    cmds: ['sticker','stickersearch','togif','tojpeg','emojimix','textsticker','qrcode','react','ocr','ascii','color','getpp','togstatus','statussave','captionimage','quotly','viewonce'] },
    { id: 6,  icon: '👥',  name: 'Group Management',    cmds: ['kick','promote','demote','ban','unban','banlist','tagall','hidetag','poll','multipoll','pollresult','lock','unlock','link','revoke','setname','setdesc','broadcast','purge','dmall','warn','mute','unmute','pin','unpin','edit','groupinfo','grouprules','groupstatus','setbio'] },
    { id: 7,  icon: '👋',  name: 'Welcome & Events',    cmds: ['welcome','goodbye','setwelcome','setgoodbye','welcomequiz','setquiz'] },
    { id: 8,  icon: '🛡️', name: 'Protection',          cmds: ['antidemote','antidelete','antilink','anticall','antivv','antiscam','antibadwords','antibot','antifake','antiflood','antigm','antispam','afk','auditlog','blocklist','block','unblock','warn','warnlist','clearwarn'] },
    { id: 9,  icon: '😄',  name: 'Fun & Entertainment', cmds: ['joke','fact','riddle','meme','quote','advice','compliment','flip','bible','pickup','roast','truth','dare','ship','pair','marry','divorce','slots','8ball'] },
    { id: 10, icon: '🔧',  name: 'Text & Dev Tools',    cmds: ['reverse','upper','lower','mock','binary','rot13','json','timestamp','regex','httpcode','password','hash','encode','decode','wordcount','urlencode','urldecode','morse','base64','carbon','cron','chmod','ascii'] },
    { id: 11, icon: '📊',  name: 'Leveling & Analytics',cmds: ['level','rank','xp','leaderboard','analytics','topusers','peakhours','presence'] },
    { id: 12, icon: '📰',  name: 'Channels',            cmds: ['newsletter','followchannel','unfollowchannel','channelinfo'] },
    { id: 13, icon: '🎮',  name: 'Games',               cmds: ['rps','hangman','ttt','trivia','slots','8ball','scramble','flagquiz','mathquiz','wordchain','emojiguess','numberguess','wordgame','capitalquiz','tictactoe','typerace','dailychallenge','challenge'] },
    { id: 14, icon: '💰',  name: 'Finance & Crypto',    cmds: ['crypto','loan','savings','tax','split','salary','discount','currency','budget','expense','balances','networth','inflation','invest','bitcoin'] },
    { id: 15, icon: '📚',  name: 'Education',           cmds: ['element','planet','zodiac','vocab','acronym','flag','nato','phrasebook','define','bible'] },
    { id: 16, icon: '📝',  name: 'Productivity',        cmds: ['remind','rremind','myreminders','bookmark','save','saved','notes','addnote','todo','autoreply','awaymsg','schedule','timer','expense'] },
    { id: 17, icon: '💪',  name: 'Health & Fitness',    cmds: ['workout','stretching','calories','water','sleep','meditation','steps','yoga','bmi'] },
    { id: 18, icon: '🤝',  name: 'Lend & Sub-bot',      cmds: ['lend','approvelend','rejectlend','revokelend','lendlist','lendstatus','subbot','subbots','mybotinfo','getcode','paircode','getpair','sessioncode','connectbot'] },
    { id: 19, icon: '🕵️', name: 'Stalk & Lookup',      cmds: ['stalk','devicecheck','whois','githubstalk','tiktokstalk','checkscam','virus','tempmail','dns','ipinfo'] },
    { id: 20, icon: 'ℹ️', name: 'Bot Info',            cmds: ['alive','ping','uptime','owner','getjid','repo','menu','help','support','call','botinfo'] },
    { id: 21, icon: '👑',  name: 'Owner & Sudo',        cmds: ['sudo','setsudo','delsudo','getsudo','resetsudo','block','unblock','setmode','setprefix','setbotname','join','cmd','restart','shutdown','backupgroup','restoregroup','broadcast','eval','dmall','autojoin','cleanup','lendlimit'] },
];

// ── Box drawing ───────────────────────────────────────────────────────────────
function hline(n = 38) { return '─'.repeat(n); }

function box(title, lines) {
    return `╭─「 ${title} 」\n${lines.map(l => `│  ${l}`).join('\n')}\n╰${hline()}`;
}

// ── Load all active plugins ───────────────────────────────────────────────────
function loadPlugins() {
    const dir = path.join(__dirname);
    const out = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
        try {
            const p = require(path.join(dir, f));
            if (Array.isArray(p.commands) && p.commands.length) out.push(p);
        } catch { }
    }
    return out;
}

// ── Compact overview (`.menu`) ────────────────────────────────────────────────
function buildCompactMenu(plugins, pfx, botName, mode) {
    const allCmds   = new Set(plugins.flatMap(p => p.commands || []));
    const modeEmoji = mode === 'PUBLIC' ? '🟢' : mode === 'PRIVATE' ? '🔒' : '🔵';
    const now       = moment().tz(TZ);
    let totalAssigned = 0;

    const header =
        `\n╔══════════════════════════════════╗\n` +
        `║  ⚡  *${botName.toUpperCase().slice(0,26).padEnd(26)}*  ⚡  ║\n` +
        `║   _The Ultimate WhatsApp Bot_    ║\n` +
        `╚══════════════════════════════════╝\n`;

    const statusBlock = box(`📋 Bot Status`, [
        `◆ *Bot:*      ${botName}`,
        `◆ *Prefix:*   \`${pfx}\``,
        `◆ *Mode:*     ${modeEmoji} ${mode}`,
        `◆ *Commands:* ${allCmds.size}`,
        `◆ *Date:*     ${now.format('ddd D MMM YYYY')}`,
        `◆ *Time:*     ${now.format('hh:mm A')} EAT`,
    ]);

    // Numbered category list with command counts
    const catLines = [];
    for (const cat of CATEGORIES) {
        const found = [...new Set(cat.cmds.filter(c => allCmds.has(c)))];
        if (!found.length) continue;
        totalAssigned += found.length;
        const num = String(cat.id).padStart(2, ' ');
        catLines.push(`│  *${num}.* ${cat.icon}  ${cat.name.padEnd(22)} *(${found.length})*`);
    }

    const catBlock =
        `\n╭${hline()}\n` +
        `│  📋 *COMMAND CATEGORIES*\n` +
        `│  _(type \`.menu <number>\` for full list)_\n` +
        `├${hline()}\n` +
        catLines.join('\n') +
        `\n╰${hline()}`;

    const footer =
        `\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮\n` +
        `│  📖 *Read More Examples:*         │\n` +
        `│  \`${pfx}menu 3\`  → AI & Intelligence │\n` +
        `│  \`${pfx}menu 6\`  → Group Management  │\n` +
        `│  \`${pfx}menu 18\` → Lend & Sub-bot    │\n` +
        `│  \`${pfx}help <cmd>\` → Command help   │\n` +
        `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯\n` +
        `\n> 🌐 _${WEBSITE}_\n` +
        `> ⚡ _Made by Abrar Hashmi Studios © ${now.year()}_`;

    return `${header}${statusBlock}\n${catBlock}\n${footer}`;
}

// ── Category detail page (`.menu <id>`) ───────────────────────────────────────
function buildCategoryMenu(cat, plugins, pfx) {
    const allCmds = new Set(plugins.flatMap(p => p.commands || []));
    const descMap = new Map(
        plugins.flatMap(p => (p.commands || []).map(c => [c, { desc: p.description || '', usage: p.usage || '', perm: p.permission || 'public' }]))
    );
    const found = [...new Set(cat.cmds.filter(c => allCmds.has(c)))];
    if (!found.length) return `❌ No commands found in *${cat.name}*.`;

    const PERM_ICON = { owner: '👑', admin: '⚙️', public: '🌍' };
    const lines = found.map(c => {
        const info    = descMap.get(c) || {};
        const pIcon   = PERM_ICON[(info.perm || 'public').toLowerCase()] || '🌍';
        const shortD  = (info.desc || '').slice(0, 45);
        return `│  ${pIcon} \`${pfx}${c}\`${shortD ? `\n│     _${shortD}_` : ''}`;
    });

    const header =
        `\n${cat.icon} *${cat.name.toUpperCase()}*\n` +
        `_${found.length} command${found.length !== 1 ? 's' : ''} available_\n`;

    const cmdBlock =
        `╭${hline()}\n` +
        lines.join('\n│\n') +
        `\n╰${hline()}`;

    const footer =
        `\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮\n` +
        `│ \`${pfx}help <cmd>\` for details │\n` +
        `│ \`${pfx}menu\` for overview      │\n` +
        `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯\n` +
        `\n_🌍 Public  ⚙️ Admin  👑 Owner_`;

    return `${header}${cmdBlock}${footer}`;
}

// ── Individual command help (`.help <cmd>`) ────────────────────────────────────
function buildCommandHelp(cmdName, plugins, pfx) {
    const plugin = plugins.find(p => (p.commands || []).includes(cmdName));
    if (!plugin) {
        return `❌ Command \`${pfx}${cmdName}\` not found.\n\nUse \`${pfx}menu\` to browse all commands.`;
    }
    const aliases = (plugin.commands || []).filter(c => c !== cmdName);
    const perm    = (plugin.permission || 'public').toLowerCase();
    const permTag = perm === 'owner' ? '👑 Owner only' : perm === 'admin' ? '⚙️ Admin only' : '🌍 Public';

    return [
        ``,
        `📖 *Command Help*`,
        ``,
        box(`${pfx}${cmdName}`, [
            `◆ *Description:*`,
            `   ${plugin.description || 'No description available.'}`,
            ``,
            `◆ *Usage:*`,
            `   ${plugin.usage ? plugin.usage.replace(/\./g, pfx) : `\`${pfx}${cmdName}\``}`,
            ``,
            `◆ *Permission:*  ${permTag}`,
            `◆ *Group:*       ${plugin.group ? '✅ Yes' : '❌ No'}`,
            `◆ *Private:*     ${plugin.private !== false ? '✅ Yes' : '❌ No'}`,
            ...(aliases.length ? [`◆ *Aliases:*     ${aliases.map(a => `\`${pfx}${a}\``).join(' • ')}`] : []),
        ]),
        ``,
        `> _Use \`${pfx}menu\` to browse all commands_`
    ].join('\n');
}


// ── HASHMI-MD interactive helpers (buttons + list, number fallback) ──────────
function hmStateKey(ctx) { return `${ctx.jid}|${ctx.from || ctx.sender || ctx.jid}`; }
function registerMenuState(ctx, options) {
    if (!global.hashmiMenuState) global.hashmiMenuState = new Map();
    global.hashmiMenuState.set(hmStateKey(ctx), { options, at: Date.now() });
}
function chunkArr(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
// Live test 2026-10-09: WhatsApp unofficial relay par nativeFlow (buttons/list)
// chup chaap daba deta hai — command dispatch hoti hai, jawab ata hi nahi.
// Is liye interactive default BAND hai; image + numbered text menu hi chalega
// (number reply bhi active hai). Interactive tabhi chalega jab HASHMI_INTERACTIVE=1 ho.
const HM_INTERACTIVE = process.env.HASHMI_INTERACTIVE === '1';
async function tryInteractive(sock, message, ctx, opts) {
    if (!HM_INTERACTIVE) return false;
    if (!generateWAMessageFromContent) return false;
    try {
        const msg = generateWAMessageFromContent(ctx.jid, {
            interactiveMessage: {
                header: { title: opts.title, hasMediaAttachment: false },
                body:   { text: opts.body },
                footer: { text: opts.footer || 'HASHMI-MD • Abrar Hashmi Studios' },
                nativeFlowMessage: { buttons: opts.buttons, messageParamsJson: '' }
            }
        }, { quoted: message, userJid: sock.user?.id });
        await sock.relayMessage(ctx.jid, msg.message, { messageId: msg.key.id });
        return true;
    } catch { return false; }
}

// ── Plugin ────────────────────────────────────────────────────────────────────
module.exports = {
    commands:    ['menu', 'help', 'list', 'cmds', 'commands'],
    description: 'Show all commands in a categorized menu — use .menu <number> for a category deep-dive',
    usage:       '.menu | .menu <1-21> | .menu <category name> | .help <command>',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { prefix, contextInfo, safeSend } = ctx;
        const plugins = loadPlugins();
        const botName = getStr('botName') || config.BOT_NAME || 'HASHMI-MD';
        const mode    = (config.MODE || 'public').toUpperCase();
        const pfx     = prefix || '.';
        const imgUrl  = getStr('pic1') || config.ALIVE_IMG || 'https://abrar-series.vercel.app/assets/portrait-720.webp';

        const rawCmd = (
            message.message?.extendedTextMessage?.text ||
            message.message?.conversation || ''
        ).trim().split(/\s+/)[0].replace(/^[^\w]/, '').toLowerCase();

        // ── .help <command> ─────────────────────────────────────────────────
        if (rawCmd === 'help' && args.length) {
            const cmdName = args[0].replace(/^\./, '').toLowerCase();
            return safeSend({ text: buildCommandHelp(cmdName, plugins, pfx), contextInfo }, { quoted: message });
        }

        // ── .menu prompt <cmd> — button click ke baad user se input mangna ──
        if (args[0] === 'prompt' && args[1]) {
            const pcmd = args[1].toLowerCase();
            const prompt = INPUT_COMMANDS[pcmd];
            if (!prompt) return safeSend({ text: '⚠️ Ye option abhi tayyar nahi hai.', contextInfo }, { quoted: message });
            if (!global.hashmiPendingInput) global.hashmiPendingInput = new Map();
            global.hashmiPendingInput.set(hmStateKey(ctx), { cmd: pcmd, at: Date.now() });
            return safeSend({ text: `${prompt}

_5 minute ke andar bhej do. Menu ke liye sirf *menu* likh do._`, contextInfo }, { quoted: message });
        }

        // ── .menu <id|name> — read-more for a specific category ─────────────
        if (args.length) {
            const query = args.join(' ').toLowerCase().trim();

            const byNum  = /^\d+$/.test(query) ? CATEGORIES.find(c => c.id === parseInt(query, 10)) : null;
            const byName = !byNum ? CATEGORIES.find(c => c.name.toLowerCase().includes(query)) : null;
            const cat    = byNum || byName;

            if (cat) {
                const allCmds2 = new Set(plugins.flatMap(pp => pp.commands || []));
                const found2 = [...new Set(cat.cmds.filter(c => allCmds2.has(c)))];
                registerMenuState(ctx, found2.map(c => 'hm:cmd:' + c));
                const rows2 = found2.slice(0, 30).map(c => ({ id: 'hm:cmd:' + c, title: c, description: (plugins.find(pp => (pp.commands || []).includes(c))?.description || '').slice(0, 60) }));
                const sections2 = chunkArr(rows2, 10).map((rs, i) => ({ title: cat.icon + ' ' + cat.name + ' ' + (i + 1), rows: rs }));
                const body2 = cat.icon + ' *' + cat.name + '*\n\nNeeche button se option chuno — ya number reply kar do:\n\n' + found2.slice(0, 30).map((c, i) => (i + 1) + '. ' + c).join('\n');
                const okCat = await tryInteractive(sock, message, ctx, {
                    title: botName,
                    body: body2,
                    buttons: [
                        { name: 'single_select', buttonParamsJson: JSON.stringify({ title: cat.icon + ' ' + cat.name, sections: sections2 }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬅️ Main Menu', id: 'hm:menu' }) }
                    ]
                });
                if (okCat) return;
                return safeSend({ text: buildCategoryMenu(cat, plugins, pfx) + '\n\n👉 *Number reply karke bhi option chun sakte ho.*', contextInfo }, { quoted: message });
            }

            const cmdName = query.replace(/^\./, '');
            const plugin  = plugins.find(p => (p.commands || []).includes(cmdName));
            if (plugin) {
                return safeSend({ text: buildCommandHelp(cmdName, plugins, pfx), contextInfo }, { quoted: message });
            }

            const examples = CATEGORIES.slice(0, 6).map(c => `  \`${pfx}menu ${c.id}\` — ${c.icon} ${c.name}`).join('\n');
            return safeSend({
                text: `❌ *"${query}"* didn't match any category or command.\n\n📋 *Try:*\n${examples}\n\nOr use \`${pfx}menu\` for the full overview.`,
                contextInfo
            }, { quoted: message });
        }

        // ── .menu — compact overview ─────────────────────────────────────────
        const menuText = buildCompactMenu(plugins, pfx, botName, mode);

        // HASHMI-MD: pehle interactive (buttons + list), chale to wahin ruk
        const allCmdsM = new Set(plugins.flatMap(pp => pp.commands || []));
        const liveCats = CATEGORIES
            .map(c => ({ ...c, count: [...new Set(c.cmds.filter(x => allCmdsM.has(x)))].length }))
            .filter(c => c.count);
        registerMenuState(ctx, liveCats.map(c => 'hm:cat:' + c.id));
        const catRows = liveCats.map(c => ({ id: 'hm:cat:' + c.id, title: c.icon + ' ' + c.name, description: c.count + ' options' }));
        const sectionsM = chunkArr(catRows, 11).map((rs, i) => ({ title: i ? 'More Categories' : 'Categories', rows: rs }));
        const shortBody = '⚡ *' + botName + '*\n_' + allCmdsM.size + ' options — dot type karne ki bilkul zaroorat nahi!_\n\nNeeche *Menu Kholo* se category chuno, ya sirf number reply kar do:\n\n' + liveCats.map((c, i) => (i + 1) + '. ' + c.icon + ' ' + c.name).join('\n');
        const sentInteractive = await tryInteractive(sock, message, ctx, {
            title: botName,
            body: shortBody,
            buttons: [
                { name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📋 Menu Kholo', sections: sectionsM }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🤖 AI Chat', id: 'hm:cmd:ai' }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👑 Owner', id: 'hm:cmd:owner' }) }
            ]
        });
        if (sentInteractive) return;


        // Try image + caption first, fall back to plain text
        try {
            await safeSend({ image: { url: imgUrl }, caption: menuText, contextInfo }, { quoted: message });
        } catch {
            await safeSend({ text: menuText, contextInfo }, { quoted: message });
        }
    }
};
