import { useState, useCallback } from 'react';
import { BLE_UART_SERVICE_UUID, BLE_UART_WRITE_UUID, BLE_UART_NOTIFY_UUID } from '../lib/bluetooth/provisioningProtocol';

interface BluetoothState {
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  writeChar: BluetoothRemoteGATTCharacteristic | null;
  notifyChar: BluetoothRemoteGATTCharacteristic | null;
  isConnected: boolean;
  error: string | null;
}

export function useBluetoothProvisioning() {
  const [state, setState] = useState<BluetoothState>({
    device: null,
    server: null,
    writeChar: null,
    notifyChar: null,
    isConnected: false,
    error: null,
  });

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [BLE_UART_SERVICE_UUID] }],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_UART_SERVICE_UUID);
      const writeChar = await service.getCharacteristic(BLE_UART_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(BLE_UART_NOTIFY_UUID);

      setState({
        device,
        server,
        writeChar,
        notifyChar,
        isConnected: true,
        error: null,
      });

      return { device, server, writeChar, notifyChar };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to connect to BLE device';
      setState(prev => ({ ...prev, error: errMsg, isConnected: false }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (state.device && state.device.gatt.connected) {
      await state.device.gatt.disconnect();
    }
    setState({
      device: null,
      server: null,
      writeChar: null,
      notifyChar: null,
      isConnected: false,
      error: null,
    });
  }, [state.device]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
