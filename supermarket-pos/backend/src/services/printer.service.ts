import net from 'net';
import { buildReceiptBytes, buildTestReceiptBytes } from './receipt.service';
import { getSettings } from './settings.service';
import { ValidationError } from '../utils/errors';

const CONNECT_TIMEOUT_MS = 5000;

async function sendBytes(bytes: Buffer): Promise<void> {
  const settings = await getSettings();
  const host = String(settings['pos.printerHost'] ?? '').trim();
  const port = Number(settings['pos.printerPort'] ?? 9100);

  if (!host) {
    throw new ValidationError(
      'No network printer is configured. Set the printer IP in Settings, or switch printing mode to browser.',
    );
  }

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new ValidationError(`Timed out connecting to the printer at ${host}:${port}`));
    }, CONNECT_TIMEOUT_MS);

    socket.connect(port, host, () => {
      socket.write(bytes, (err) => {
        clearTimeout(timeout);
        if (err) {
          socket.destroy();
          reject(new ValidationError(`Failed to send data to the printer: ${err.message}`));
          return;
        }
        socket.end();
        resolve();
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new ValidationError(`Could not reach the printer at ${host}:${port}: ${err.message}`));
    });
  });
}

export async function printReceiptOverNetwork(saleId: string): Promise<void> {
  await sendBytes(await buildReceiptBytes(saleId));
}

export async function printTestPageOverNetwork(): Promise<void> {
  await sendBytes(await buildTestReceiptBytes());
}
