import { renderHook, act } from '@testing-library/react';
import { useOAuth2 } from '../useOAuth2';
import Cookies from 'js-cookie';
jest.mock('js-cookie');

describe('useOAuth2', () => {
    const WSLogoutAndRedirect = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should set cookie and call WSLogoutAndRedirect on logout complete message', async () => {

        const { result } = renderHook(() =>
            useOAuth2(WSLogoutAndRedirect)
        );

        await act(async () => {
            result.current.OAuth2Logout();
        });

        const event = new MessageEvent('message', {
            data: 'logout_complete',
            origin: 'http://logout.url',
        });

        window.dispatchEvent(event);

        expect(Cookies.set).toHaveBeenCalledWith('logged_state', 'false', {
            domain: 'localhost',
            secure: true,
            expires: 30,
            path: '/',
        });
        expect(WSLogoutAndRedirect).toHaveBeenCalled();
    });

    it('should call WSLogoutAndRedirect on timeout', async () => {
        jest.useFakeTimers();

        const { result } = renderHook(() =>
            useOAuth2(WSLogoutAndRedirect)
        );

        await act(async () => {
            result.current.OAuth2Logout();
        });

        jest.advanceTimersByTime(10000);

        expect(WSLogoutAndRedirect).toHaveBeenCalled();
    });

    it('should handle iframe onError event and call WSLogoutAndRedirect', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() =>
            useOAuth2(WSLogoutAndRedirect)
        );

        await act(async () => {
            result.current.OAuth2Logout();
        });

        const iframe = document.getElementById('logout-iframe') as HTMLIFrameElement;

        expect(iframe).not.toBeNull();

        act(() => {
            iframe.onerror?.(new ErrorEvent('error', { message: 'Something went wrong with the iframe' }));
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'There has been a problem with the logout: ',
            expect.any(ErrorEvent)
        );
    });
});
