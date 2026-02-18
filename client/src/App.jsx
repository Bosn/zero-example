import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Best effort parse for API errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const remaining = useMemo(() => todos.filter((todo) => !todo.completed).length, [todos]);

  async function loadTodos() {
    setLoading(true);
    setError("");
    try {
      const rows = await request("/api/todos");
      setTodos(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTodos();
  }, []);

  async function onCreate(event) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const created = await request("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: nextTitle })
      });
      setTodos((previous) => [created, ...previous]);
      setTitle("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggle(todo) {
    setError("");
    try {
      const updated = await request(`/api/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !todo.completed })
      });
      setTodos((previous) => previous.map((item) => (item.id === todo.id ? updated : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete(todoId) {
    setError("");
    try {
      await request(`/api/todos/${todoId}`, { method: "DELETE" });
      setTodos((previous) => previous.filter((todo) => todo.id !== todoId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>TiDB Cloud Zero TODOs</h1>
        <p className="subtitle">Node.js + React + TiDB Cloud Zero</p>

        <form className="composer" onSubmit={onCreate}>
          <input
            aria-label="Todo title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting || !title.trim()}>
            Add
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {loading ? (
          <p className="empty">Loading TODOs...</p>
        ) : todos.length === 0 ? (
          <p className="empty">No TODOs yet. Add your first one.</p>
        ) : (
          <ul className="list">
            {todos.map((todo) => (
              <li key={todo.id} className="item">
                <label>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => onToggle(todo)}
                  />
                  <span className={todo.completed ? "done" : ""}>{todo.title}</span>
                </label>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(todo.id)}
                  aria-label={`Delete ${todo.title}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="footer">
          {remaining} remaining / {todos.length} total
        </footer>
      </section>
    </main>
  );
}
