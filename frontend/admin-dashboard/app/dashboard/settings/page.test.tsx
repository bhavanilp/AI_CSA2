import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import SettingsPage from './page';

jest.mock('axios');

const replace = jest.fn();
const router = { replace };

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('token', 'token-123');
    window.localStorage.setItem('user', JSON.stringify({ email: 'admin@aicsa.local', role: 'admin' }));
  });

  it('renders health status and saves UI preferences locally', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
        dependencies: {
          database: 'ok',
          vector_db: 'ok',
          llm_provider: 'ok',
        },
        vector_store: {
          ingested_url_count: 2,
        },
      },
    } as any);

    render(<SettingsPage />);

    expect(await screen.findByText('Status:')).toBeInTheDocument();
    expect(screen.getByText(/Ingested URLs:/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));

    await waitFor(() => {
      expect(window.localStorage.getItem('dashboard_refresh_ms')).toBe('60000');
      expect(window.localStorage.getItem('dashboard_show_hints')).toBe('false');
    });
  });
});