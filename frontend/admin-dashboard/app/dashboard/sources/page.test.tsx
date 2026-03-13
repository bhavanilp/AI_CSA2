import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import SourcesPage from './page';

jest.mock('axios');

const replace = jest.fn();
const router = { replace };

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SourcesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('token', 'token-123');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('removes an ingested URL from vector store', async () => {
    mockedAxios.get.mockImplementation((url) => {
      if (url === '/api/admin/sources') {
        return Promise.resolve({ data: { sources: [] } } as any);
      }

      if (url === '/api/chat/ingested-urls') {
        return Promise.resolve({
          data: { urls: ['https://en.wikipedia.org/wiki/Hyderabad'] },
        } as any);
      }

      return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        url: 'https://en.wikipedia.org/wiki/Hyderabad',
        deleted_vector_count: 10,
        deleted_source_count: 1,
      },
    } as any);

    render(<SourcesPage />);

    expect(await screen.findByText('https://en.wikipedia.org/wiki/Hyderabad')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Remove this URL from the vector store?\n\nhttps://en.wikipedia.org/wiki/Hyderabad',
    );

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/admin/sources/remove-url',
        { url: 'https://en.wikipedia.org/wiki/Hyderabad' },
        expect.any(Object),
      );
    });
  });
});
