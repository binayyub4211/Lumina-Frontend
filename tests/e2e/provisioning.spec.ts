/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

test.describe('BLE Provisioning Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockCharacteristicNotify = {
        startNotifications: async () => {},
        stopNotifications: async () => {},
        addEventListener: function(event, cb) { this._cb = cb; },
        removeEventListener: function() {},
        simulateNotification: function(val) {
          if (this._cb) this._cb({ target: this, value: val });
        },
      };

      const mockCharacteristicWrite = {
        writeValue: async (val) => {
          console.log('BLE Write:', val);
          return Promise.resolve();
        },
      };

      const mockService = {
        getCharacteristic: async (uuid) => {
          if (uuid === '6e400002-b5a3-f393-e0a9-e50e24dcca9e') return mockCharacteristicWrite;
          if (uuid === '6e400003-b5a3-f393-e0a9-e50e24dcca9e') return mockCharacteristicNotify;
          throw new Error('Service not found');
        },
      };

      const mockServer = {
        getPrimaryService: async () => mockService,
        disconnect: async () => {},
      };

      const mockDevice = {
        name: 'Test Node',
        gatt: {
          connect: async () => mockServer,
          connected: true,
        },
      };

      navigator.bluetooth = {
        requestDevice: async () => mockDevice,
      } as any;

      (window as any)._mockNotifyChar = mockCharacteristicNotify;
    });
  });

  test('should complete full provisioning flow', async ({ page }) => {
    await page.goto('/admin/provisioning');

    // Step 1: Scan
    await page.getByText('Open Device Scanner').click();
    await page.getByText('Scan for Devices').click();
    
    // Should move to configure step
    await expect(page.getByText('Configuration')).toBeVisible();

    // Step 2: Configure
    await page.getByText('Write Config').click();

    // Should move to verify step
    await expect(page.getByText('Verifying Handshake...')).toBeVisible();

    // Step 3: Verify - Simulate success response
    await page.evaluate(() => {
      const encoder = new TextEncoder();
      const data = encoder.encode('PROVISIONING SUCCESS');
      (window as any)._mockNotifyChar.simulateNotification(data);
    });

    await expect(page.getByText('Provisioning Successful!')).toBeVisible();
  });
});
