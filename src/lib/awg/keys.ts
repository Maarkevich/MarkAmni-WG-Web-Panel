// ============================================
// keys.ts — генерация Curve25519 ключей (awg/wg tools или tweetnacl)
// ============================================
import { execFile } from 'child_process';
import nacl from 'tweetnacl';

let hasTools: string | null = null; // null = не проверяли

function which(bin: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('which', [bin], (err, out) => resolve(!err && out ? out.trim() : ''));
  });
}

export async function detectTools(): Promise<string> {
  if (hasTools !== null) return hasTools;
  const awg = await which('awg');
  const wg = awg ? '' : await which('wg');
  hasTools = awg || wg || '';
  return hasTools;
}

// Clamp приватного ключа по правилам Curve25519 (как делает wg genkey)
function clampPriv(buf: Uint8Array): Buffer {
  const b = Buffer.from(buf);
  b[0] &= 248;
  b[31] &= 127;
  b[31] |= 64;
  return b;
}

function naclKeypair() {
  const priv = clampPriv(nacl.randomBytes(32));
  const pub = nacl.scalarMult.base(new Uint8Array(priv));
  return {
    privateKey: priv.toString('base64'),
    publicKey: Buffer.from(pub).toString('base64')
  };
}

function naclPsk(): string {
  return Buffer.from(nacl.randomBytes(32)).toString('base64');
}

// Публичный ключ из приватного (tweetnacl)
export function pubFromPriv(privB64: string): string {
  try {
    const priv = Buffer.from(privB64, 'base64');
    if (priv.length !== 32) return '';
    const pub = nacl.scalarMult.base(new Uint8Array(priv));
    return Buffer.from(pub).toString('base64');
  } catch {
    return '';
  }
}

function runTool(bin: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = execFile(bin, args, { maxBuffer: 1024 * 64 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
    if (input) {
      p.stdin?.write(input + '\n');
      p.stdin?.end();
    }
  });
}

// Полная пара ключей + PSK. Приоритет — системные утилиты awg/wg.
export async function generateKeypair(): Promise<{ privateKey: string; publicKey: string; presharedKey: string }> {
  const tool = await detectTools();
  if (tool) {
    try {
      const priv = await runTool(tool, ['genkey']);
      const pub = await runTool(tool, ['pubkey'], priv);
      const psk = await runTool(tool, ['genpsk']);
      return { privateKey: priv, publicKey: pub, presharedKey: psk };
    } catch (e) {
      console.error('[keys] tools failed, fallback to nacl:', (e as Error).message);
    }
  }
  const kp = naclKeypair();
  return { ...kp, presharedKey: naclPsk() };
}

export async function generatePsk(): Promise<string> {
  const tool = await detectTools();
  if (tool) {
    try { return await runTool(tool, ['genpsk']); } catch { /* fallback ниже */ }
  }
  return naclPsk();
}

// Проверка валидности base64 32-байтного ключа
export function validKey(b64: string): boolean {
  if (typeof b64 !== 'string') return false;
  const s = b64.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false;
  try {
    return Buffer.from(s, 'base64').length === 32;
  } catch {
    return false;
  }
}
