import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

// Mock data for search
const mockData = [
  { id: 1, name: "Alice", description: "Software Engineer" },
  { id: 2, name: "Alina", description: "Software Engineer" },
  { id: 3, name: "Alixa", description: "Software Engineer" },
  { id: 4, name: "Bob", description: "Data Scientist" },
  { id: 5, name: "Charlie", description: "Product Manager" },
  { id: 6, name: "Charlito", description: "Product Manager" },
  { id: 7, name: "Diana", description: "UX Designer" },
];

// Simulated search function
const search = async (
  query: string
): Promise<{ id: number; name: string; description: string }[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const results = mockData.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      );
      resolve(results);
    }, 500);
  });
};

// RateLimiter class
type Success<T> = { type: "success"; data: T };
type Failure = { type: "failure" };
type Persons = { id: number; name: string; description: string };

class RateLimiter<T, A extends any[]> {
  private maxRequests: number;
  private timeWindow: number;
  private func: (...args: A) => Promise<T>;
  private timestamps: number[] = [];
  public error: string | null = null;

  constructor(
    maxRequests: number,
    timeWindow: number,
    func: (...args: A) => Promise<T>
  ) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.func = func;
  }

  private calculateRemainingTime(): number | null {
    const now = Date.now();
    if (this.timestamps.length === 0) return null;

    const earliestTimestamp = this.timestamps[0];
    const timeElapsed = now - earliestTimestamp;
    if (timeElapsed >= this.timeWindow) {
      this.error = null; // Clear error if enough time has passed
      return null;
    }

    return Math.ceil((this.timeWindow - timeElapsed) / 1000); // Remaining time in seconds
  }

  public updateErrorTime() {
    if (this.timestamps.length >= this.maxRequests) {
      const remainingTime = this.calculateRemainingTime();
      this.error = `Rate exceeded, please wait ${remainingTime} seconds.`;
    }
    if (this.calculateRemainingTime() == null) {
      this.error = null;
    }
  }

  public invoke = async (...args: A): Promise<Success<T> | Failure> => {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.timeWindow
    );

    if (this.timestamps.length >= this.maxRequests) {
      return { type: "failure" };
    }

    this.timestamps.push(now);
    this.error = null;
    const result = await this.func(...args);
    return { type: "success", data: result };
  };
}

// Create RateLimiter instance
const limiter = new RateLimiter(2, 15000, search);

function useDebounce<T>(
  initialValue: Persons[],
  targetFunction: (query: string) => Promise<Persons[]>,
  delay: number,
  query: string
): Persons[] {
  const [value, setValue] = useState<Persons[]>(initialValue);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.length > 0) {
        const result = await targetFunction(query);
        setValue(result);
      } else {
        setValue(initialValue); // Reset to initial value if query is empty
      }
    }, delay);

    // Cleanup the timeout on unmount or query change
    return () => clearTimeout(handler);
  }, [query, delay, targetFunction, initialValue]);

  return value;
}

const autocomplete = async (query: string): Promise<Persons[]> => {
  const lowerCaseQuery = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        mockData.filter((item) =>
          item.name.toLowerCase().startsWith(lowerCaseQuery)
        )
      );
    }, 500); // Simulating async API delay
  });
};

const App: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<
    { id: number; name: string; description: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [charError, setCharError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const autoCompleteResults = useDebounce<string[]>(
    [],
    autocomplete,
    250,
    query
  );

  useEffect(() => {
    const interval = setInterval(() => {
      limiter.updateErrorTime();
      setError(limiter.error); // Poll the limiter's error property
    }, 1000);

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);

  const handleSearch = async () => {
    if (query.length < 3) {
      setCharError("Query must be at least 3 characters long.");
      return;
    }
    setError(null);
    setCharError(null);
    setLoading(true);
    const response = await limiter.invoke(query);

    if (response.type === "success") {
      setSearchMessage(`Search result for "${query}"`);
      if (response.data.length > 0) {
        setResults(response.data);
      } else {
        setResults(null); // Clear previous results on failure
      }
    } else {
      setSearchMessage(null);
      setResults(null);
    }

    setLoading(false);
    setQuery(""); // Clear input field
  };

  return (
    <div className="container mt-5">
      <div className="mb-3">
        <label htmlFor="searchInput" className="form-label">
          Search:
        </label>
        <div className="input-group">
          <input
            type="text"
            id="searchInput"
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading || !!error}
          />
          <ul className="list-group mt-3">
            {autoCompleteResults.map((result, index) => (
              <li key={index} className="list-group-item">
                {result.name}
              </li>
            ))}
          </ul>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={loading || !!error}
          >
            {loading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Search"
            )}
          </button>
        </div>
        {error && <div className="text-danger mt-2">{error}</div>}
        {charError && <div className="text-danger mt-2">{charError}</div>}
      </div>
      {searchMessage && <h2>{searchMessage}</h2>}
      {results && (
        <table className="table table-striped mt-4">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{result.id}</td>
                <td>{result.name}</td>
                <td>{result.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!results && <div>No results to display.</div>}
    </div>
  );
};

export default App;
