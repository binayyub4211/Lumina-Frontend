import React from 'react';

interface BLEScanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: () => Promise<void>;
  device: BluetoothDevice | null;
  isConnected: boolean;
  error: string | null;
}

export const BLEScanSheet: React.FC<BLEScanSheetProps> = ({
  isOpen,
  onClose,
  onScan,
  device,
  isConnected,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Scan for BLE Nodes</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-gray-500 mb-4 text-center px-4">
                No device selected. Click scan to find provisionable nodes.
              </p>
              <button
                onClick={async () => {
                  try {
                    await onScan();
                  } catch {
                    // Error handled by hook state
                  }
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
              >
                Scan for Devices
              </button>
            </div>
          ) : (
            <div className="p-4 border rounded-lg flex items-center justify-between bg-green-50 border-green-200">
              <div className="flex flex-col">
                <span className="font-medium text-green-800">Connected: {device?.name || 'Unknown Device'}</span>
                <span className="text-xs text-green-600">Ready for provisioning</span>
              </div>
              <div className="text-green-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
