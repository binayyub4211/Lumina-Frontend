/* eslint-disable @typescript-eslint/no-explicit-any */
export const bluetoothMock = {
  requestDevice: async () => {
    return {
      name: 'Mock-BLE-Node',
      gatt: {
        connect: async () => ({
          getPrimaryService: async () => ({
            getCharacteristic: async (charUuid: string) => {
              if (charUuid === '6e400002-b5a3-f393-e0a9-e50e24dcca9e') {
                return {
                  writeValue: async (value: Uint8Array) => {
                    console.log('Mock-BLE-Node received write:', value);
                    return Promise.resolve();
                  },
                };
              }
              if (charUuid === '6e400003-b5a3-f393-e0a9-e50e24dcca9e') {
                return {
                  startNotifications: async () => {
                    console.log('Mock-BLE-Node notifications started');
                    return Promise.resolve();
                  },
                  stopNotifications: async () => {
                    return Promise.resolve();
                  },
                  addEventListener: function(event: string, callback: (event: any) => void) {
                    if (event === 'characteristicvaluechanged') {
                      this._callback = callback;
                    }
                  },
                  removeEventListener: function() {
                    delete this._callback;
                  },
                  // Helper to simulate incoming notification
                  simulateNotification: function(value: Uint8Array) {
                    if (this._callback) {
                      this._callback({ target: this, value });
                    }
                  },
                };
              }
              throw new Error('Characteristic not found');
            },
          }),
          disconnect: async () => {
            console.log('Mock-BLE-Node disconnected');
            return Promise.resolve();
          },
        }),
      },
    };
  },
};
