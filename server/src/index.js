import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { execute, initDatabase } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/todos", async (_req, res, next) => {
  try {
    const rows = await execute(
      "SELECT id, title, author, completed, created_at AS createdAt, updated_at AS updatedAt FROM todos ORDER BY created_at DESC"
    );
    res.json(rows.map((row) => ({ ...row, completed: Boolean(row.completed) })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/todos", async (req, res, next) => {
  try {
    const title = String(req.body?.title || "").trim();
    const author = String(req.body?.author || "").trim();
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!author) {
      return res.status(400).json({ message: "Author is required" });
    }

    if (title.length > 255) {
      return res.status(400).json({ message: "Title must be 255 characters or fewer" });
    }
    if (author.length > 255) {
      return res.status(400).json({ message: "Author must be 255 characters or fewer" });
    }

    const result = await execute("INSERT INTO todos (title, author) VALUES (?, ?)", [title, author]);
    const rows = await execute(
      "SELECT id, title, author, completed, created_at AS createdAt, updated_at AS updatedAt FROM todos WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({ ...rows[0], completed: Boolean(rows[0].completed) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/todos/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const updates = [];
    const values = [];

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }
      if (title.length > 255) {
        return res.status(400).json({ message: "Title must be 255 characters or fewer" });
      }
      updates.push("title = ?");
      values.push(title);
    }

    if (req.body.author !== undefined) {
      const author = String(req.body.author).trim();
      if (!author) {
        return res.status(400).json({ message: "Author cannot be empty" });
      }
      if (author.length > 255) {
        return res.status(400).json({ message: "Author must be 255 characters or fewer" });
      }
      updates.push("author = ?");
      values.push(author);
    }

    if (req.body.completed !== undefined) {
      updates.push("completed = ?");
      values.push(Boolean(req.body.completed));
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const result = await execute(`UPDATE todos SET ${updates.join(", ")} WHERE id = ?`, [...values, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Todo not found" });
    }

    const rows = await execute(
      "SELECT id, title, author, completed, created_at AS createdAt, updated_at AS updatedAt FROM todos WHERE id = ?",
      [id]
    );

    res.json({ ...rows[0], completed: Boolean(rows[0].completed) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/todos/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const result = await execute("DELETE FROM todos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Unexpected server error" });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
