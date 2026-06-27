import React, { useState } from 'react';
import { encodeConfig } from '../../lib/bluetooth/provisioningProtocol';

interface ConfigPayloadEditorProps {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  onWriteSuccess: () => void;
  onWriteError: (error: string) => void;
}

export const ConfigPayloadEditor: React.FC<ConfigPayloadEditorProps> = ({
  writeCharacteristic,
  onWriteSuccess,
  onWriteError,
}) => {
  const [configText, setConfigText] = useState('{\n  "nodeId": "node-01",\n  "interval": 60\n}');
  const [isWriting, setIsWriting] = useState(false);

  const handleWrite = async () => {
    if (!writeCharacteristic) {
      onWriteError('No BLE device connected');
      return;
    }

    setIsWriting(true);
    try {
      const configObj = JSON.parse(configText);
      const data = encodeConfig(configObj);
      
      const chunkSize = 512;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await writeCharacteristic.writeValue(chunk);
        if (i + chunkSize < data.length) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      
      onWriteSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write configuration';
      onWriteError(message);
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-gray-50">
      <label className="text-sm font-medium text-gray-700">Node Configuration (JSON)</label>
      <textarea
        className="w-full h-64 p-2 font-mono text-sm border rounded"
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
        disabled={isWriting}
      />
      <button
        onClick={handleWrite}
        disabled={isWriting || !writeCharacteristic}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 transition-colors"
      >
        {isWriting ? 'Writing...' : 'Write Config'}
      </button>
    </div>
  );
};
