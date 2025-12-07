import { ApiError, apiCall, apiGet, apiPost, showApiError, safeApiCall } from '../static/js/api.js';

describe('ApiError', () => {
  test('creates error with message, status, and url', () => {
    const error = new ApiError('Test error', 404, '/api/test');

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(404);
    expect(error.url).toBe('/api/test');
    expect(error.name).toBe('ApiError');
  });

  test('is instanceof Error', () => {
    const error = new ApiError('Test error', 500, '/api/test');
    expect(error instanceof Error).toBe(true);
  });

  test('has correct prototype chain', () => {
    const error = new ApiError('Test error', 500, '/api/test');
    expect(error instanceof ApiError).toBe(true);
  });
});

describe('apiCall', () => {
  let originalFetch;
  let originalConsoleError;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  test('returns JSON data on successful response', async () => {
    const mockData = { success: true, data: 'test' };
    let fetchCalled = false;
    let fetchUrl = null;
    let fetchOptions = null;

    global.fetch = (url, options) => {
      fetchCalled = true;
      fetchUrl = url;
      fetchOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    };

    const result = await apiCall('/api/test');

    expect(result).toEqual(mockData);
    expect(fetchCalled).toBe(true);
    expect(fetchUrl).toBe('/api/test');
    expect(fetchOptions.headers['Content-Type']).toBe('application/json');
  });

  test('merges custom options with defaults', async () => {
    const mockData = { success: true };
    let fetchOptions = null;

    global.fetch = (url, options) => {
      fetchOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    };

    await apiCall('/api/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    });

    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify({ foo: 'bar' }));
    expect(fetchOptions.headers['Content-Type']).toBe('application/json');
  });

  test('throws ApiError on HTTP error with JSON detail', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
      });

    await expect(apiCall('/api/test')).rejects.toThrow(ApiError);
    await expect(apiCall('/api/test')).rejects.toThrow('Bad request');
  });

  test('throws ApiError on HTTP error with message field', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

    await expect(apiCall('/api/test')).rejects.toThrow(ApiError);
    await expect(apiCall('/api/test')).rejects.toThrow('Internal server error');
  });

  test('throws ApiError with statusText when JSON parsing fails', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

    await expect(apiCall('/api/test')).rejects.toThrow('Not Found');
  });

  test('throws ApiError with default message when no error info available', async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: '',
        json: async () => ({}),
      });

    await expect(apiCall('/api/test')).rejects.toThrow('Unknown error');
  });

  test('throws ApiError on network error', async () => {
    global.fetch = () => Promise.reject(new Error('Network failure'));

    await expect(apiCall('/api/test')).rejects.toThrow(ApiError);

    try {
      await apiCall('/api/test');
    } catch (error) {
      expect(error.status).toBe(0);
      expect(error.url).toBe('/api/test');
    }
  });

  test('logs errors to console', async () => {
    let errorLogged = false;
    let errorMessage = '';

    console.error = (...args) => {
      errorLogged = true;
      errorMessage = args.join(' ');
    };

    global.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found' }),
      });

    try {
      await apiCall('/api/test');
    } catch {
      // Expected to throw
    }

    expect(errorLogged).toBe(true);
    expect(errorMessage).toContain('API Error');
  });
});

describe('apiGet', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('calls apiCall with GET method', async () => {
    const mockData = { data: 'test' };
    let fetchOptions = null;

    global.fetch = (url, options) => {
      fetchOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    };

    const result = await apiGet('/api/data');

    expect(result).toEqual(mockData);
    expect(fetchOptions.method).toBe('GET');
    expect(fetchOptions.headers['Content-Type']).toBe('application/json');
  });
});

describe('apiPost', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('calls apiCall with POST method and JSON body', async () => {
    const mockData = { success: true };
    const postData = { foo: 'bar', num: 42 };
    let fetchOptions = null;

    global.fetch = (url, options) => {
      fetchOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    };

    const result = await apiPost('/api/create', postData);

    expect(result).toEqual(mockData);
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify(postData));
    expect(fetchOptions.headers['Content-Type']).toBe('application/json');
  });

  test('handles empty data object', async () => {
    const mockData = { success: true };
    let fetchOptions = null;

    global.fetch = (url, options) => {
      fetchOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    };

    await apiPost('/api/create', {});

    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify({}));
  });
});

describe('showApiError', () => {
  let originalAlert;

  beforeEach(() => {
    originalAlert = global.alert;
  });

  afterEach(() => {
    global.alert = originalAlert;
  });

  test('shows alert with error message', () => {
    let alertMessage = '';
    global.alert = (msg) => {
      alertMessage = msg;
    };

    const error = new ApiError('Test error', 404, '/api/test');
    showApiError(error);

    expect(alertMessage).toBe('Error: Test error');
  });

  test('shows custom message when provided', () => {
    let alertMessage = '';
    global.alert = (msg) => {
      alertMessage = msg;
    };

    const error = new ApiError('Test error', 404, '/api/test');
    showApiError(error, 'Custom error message');

    expect(alertMessage).toBe('Custom error message');
  });

  test('handles generic Error objects', () => {
    let alertMessage = '';
    global.alert = (msg) => {
      alertMessage = msg;
    };

    const error = new Error('Generic error');
    showApiError(error);

    expect(alertMessage).toBe('Error: Generic error');
  });
});

describe('safeApiCall', () => {
  let originalAlert;

  beforeEach(() => {
    originalAlert = global.alert;
  });

  afterEach(() => {
    global.alert = originalAlert;
  });

  test('returns result on successful API call', async () => {
    const mockData = { success: true };
    let alertCalled = false;
    let functionCalled = false;

    global.alert = () => {
      alertCalled = true;
    };
    const apiFunction = async () => {
      functionCalled = true;
      return mockData;
    };

    const result = await safeApiCall(apiFunction);

    expect(result).toEqual(mockData);
    expect(functionCalled).toBe(true);
    expect(alertCalled).toBe(false);
  });

  test('shows error and rethrows on failure', async () => {
    const error = new ApiError('Test error', 500, '/api/test');
    let alertMessage = '';

    global.alert = (msg) => {
      alertMessage = msg;
    };
    const apiFunction = async () => {
      throw error;
    };

    await expect(safeApiCall(apiFunction)).rejects.toThrow(error);
    expect(alertMessage).toBe('Error: Test error');
  });

  test('uses custom error message when provided', async () => {
    const error = new ApiError('Test error', 500, '/api/test');
    let alertMessage = '';

    global.alert = (msg) => {
      alertMessage = msg;
    };
    const apiFunction = async () => {
      throw error;
    };

    await expect(safeApiCall(apiFunction, 'Custom message')).rejects.toThrow(error);
    expect(alertMessage).toBe('Custom message');
  });

  test('passes through API function without arguments', async () => {
    const mockData = { data: 'test' };
    let functionCalled = false;

    global.alert = () => {};
    const apiFunction = async () => {
      functionCalled = true;
      return mockData;
    };

    await safeApiCall(apiFunction);

    expect(functionCalled).toBe(true);
  });
});
