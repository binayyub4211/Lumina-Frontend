export const BLE_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_UART_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_UART_NOTIFY_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

export function encodeConfig(obj: object): Uint8Array {
  const jsonString = JSON.stringify(obj);
  const encoder = new TextEncoder();
  const payload = encoder.encode(jsonString);
  
  const checksum = crc16(payload);
  const buffer = new Uint8Array(payload.length + 2);
  buffer.set(payload);
  buffer[payload.length] = (checksum >> 8) & 0xFF;
  buffer[payload.length + 1] = checksum & 0xFF;
  
  return buffer;
}

export function decodeResponse(buffer: DataView): { success: boolean; message: string } {
  const decoder = new TextDecoder();
  const uint8Array = new Uint8Array(buffer.buffer);
  const message = decoder.decode(uint8Array);
  
  return {
    success: message.includes('SUCCESS'),
    message,
  };
}
