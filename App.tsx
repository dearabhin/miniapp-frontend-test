
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { TelegramWebApp } from './types';
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Sender, SenderArguments, Address, toNano } from '@ton/ton';

// Declare the Telegram WebApp object from the global window scope
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// IMPORTANT: Replace this with your actual backend URL from Render.com
const BACKEND_URL = 'https://miniapp-frontend-test.pages.dev/upload-url';

// Custom hook to wrap the TON Connect sender
function useTonConnect(): { sender: Sender; connected: boolean } {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  return {
    sender: {
      send: async (args: SenderArguments) => {
        tonConnectUI.sendTransaction({
          messages: [
            {
              address: args.to.toString(),
              amount: args.value.toString(),
              payload: args.body?.toBoc().toString('base64'),
            },
          ],
          validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes for user to approve
        });
      },
      address: wallet?.account.address ? Address.parse(wallet?.account.address) : undefined
    },
    connected: !!wallet?.account.address,
  };
}

const App: React.FC = () => {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Safely get the Telegram WebApp object. It will be undefined if not running in a Telegram client.
  const tg = useMemo(() => window.Telegram?.WebApp, []);

  const { sender, connected } = useTonConnect();

  // Regular expression for basic URL validation
  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      const urlRegex = /^(https|http):\/\/[^\s$.?#].[^\s]*$/i;
      return urlRegex.test(urlString);
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!tg) return;

    if (!isValidUrl(url)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      tg.HapticFeedback.notificationOccurred('error');
      return;
    }
    setError('');
    tg.MainButton.showProgress(true); // Show loading spinner and disable button
    tg.MainButton.disable();
    tg.HapticFeedback.impactOccurred('light');

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // CRITICAL: Send initData for backend validation
          'X-Telegram-Init-Data': tg.initData,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit URL.');
      }

      // On success, show a confirmation and close the Mini App
      tg.HapticFeedback.notificationOccurred('success');
      tg.showAlert('URL submitted successfully!', () => {
        tg.close();
      });

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      tg.HapticFeedback.notificationOccurred('error');
      tg.showAlert(err.message || 'An unexpected error occurred.');
    } finally {
      // Re-enable the button if an error occurs. The app closes on success anyway.
      tg.MainButton.hideProgress();
      tg.MainButton.enable();
    }
  }, [url, tg]);

  // Effect for one-time setup and event listener management
  useEffect(() => {
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.MainButton.setText('Submit URL');
    tg.MainButton.show();

    tg.MainButton.onClick(handleSubmit);

    // Cleanup function to remove the event listener on component unmount
    return () => {
      tg.MainButton.offClick(handleSubmit);
    };
  }, [tg, handleSubmit]);
  
  // Effect to update the main button's state based on URL validity
  useEffect(() => {
    if (!tg) return;

      if (isValidUrl(url)) {
        tg.MainButton.enable();
        setError('');
      } else {
        tg.MainButton.disable();
      }
  }, [url, tg]);


  // If the tg object is not available, render a fallback UI.
  // This prevents the app from crashing and informs the user.
  if (!tg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: 'var(--tg-theme-bg-color, #18222d)', color: 'var(--tg-theme-text-color, #ffffff)' }}>
        <div className="w-full max-w-md text-center">
            <header>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor" style={{color: 'var(--tg-theme-button-color, #36a3f7)'}}>
                    <path d="M13.467 2.333a1.2 1.2 0 00-1.628-.76l-9 5a1.2 1.2 0 00-.506 1.838l9 15a1.2 1.2 0 002.134-.761l2-16a1.2 1.2 0 00-1.001-1.317zM3.4 7.64l8.1-4.5 1.428 11.428-9.528-6.928z" />
                    <path d="M19.667 2.033a1.2 1.2 0 00-1.4.267l-7.5 10a1.2 1.2 0 00.933 1.9h9a1.2 1.2 0 001.2-1.2v-9a1.2 1.2 0 00-2.4-.967zM12.7 12.6l6.6-8.8v7.6h-6.6z" />
                </svg>
                <h1 className="text-2xl font-bold">URL Uploader</h1>
                <p className="text-sm mt-2" style={{ color: 'var(--tg-theme-hint-color, #b1c3d5)' }}>
                    This application must be run inside Telegram.
                </p>
            </header>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-4" style={{ backgroundColor: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-text-color)' }}>
      <div className="w-full max-w-md mt-8">
        <header className="text-center mb-6 relative">
             <div className="absolute top-0 right-0">
                <TonConnectButton />
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor" style={{color: 'var(--tg-theme-button-color)'}}>
                <path d="M13.467 2.333a1.2 1.2 0 00-1.628-.76l-9 5a1.2 1.2 0 00-.506 1.838l9 15a1.2 1.2 0 002.134-.761l2-16a1.2 1.2 0 00-1.001-1.317zM3.4 7.64l8.1-4.5 1.428 11.428-9.528-6.928z" />
                <path d="M19.667 2.033a1.2 1.2 0 00-1.4.267l-7.5 10a1.2 1.2 0 00.933 1.9h9a1.2 1.2 0 001.2-1.2v-9a1.2 1.2 0 00-2.4-.967zM12.7 12.6l6.6-8.8v7.6h-6.6z" />
            </svg>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>Submit a URL</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Paste a link below. It will be sent to the bot.
          </p>
        </header>

        <main>
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com"
              className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 transition-colors"
              style={{
                backgroundColor: 'var(--tg-theme-secondary-bg-color, #2a3b4c)',
                color: 'var(--tg-theme-text-color)',
                borderColor: error ? '#ef4444' : 'var(--tg-theme-hint-color, #b1c3d5)',
                '--tw-ring-color': 'var(--tg-theme-button-color, #36a3f7)'
              } as React.CSSProperties}
              autoFocus
            />
             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5" style={{ color: 'var(--tg-theme-hint-color)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
            </div>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
          )}

          {connected && (
             <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--tg-theme-hint-color)'}}>
                <h2 className="text-lg font-semibold text-center mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>TON Actions</h2>
                <div className="flex justify-center">
                    <button
                        onClick={() => sender.send({
                            to: Address.parse('EQA4s5DP3oWpW_2L-1aIeps8rGa43f9mTpACRvVltcCk4FfR'), // Testnet Wallet 2
                            value: toNano('0.01'),
                        })}
                        className="px-6 py-2 rounded-lg font-bold transition-colors"
                        style={{
                            backgroundColor: 'var(--tg-theme-button-color, #36a3f7)',
                            color: 'var(--tg-theme-button-text-color, #ffffff)'
                        }}
                    >
                        Send 0.01 TON
                    </button>
                </div>
                <p className="text-xs text-center mt-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
                    This will send a test transaction on the TON testnet.
                </p>
            </div>
          )}
        </main>
      </div>
       <footer className="w-full text-center p-4 mt-auto">
        <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Powered by Telegram Mini Apps & TON
        </p>
      </footer>
    </div>
  );
};

export default App;
