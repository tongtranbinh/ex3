const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect("mongodb+srv://tongtranbinh30082005_db_user:AKwhYzTw8nvPe5Ym@ttbcluster.mjcdjnd.mongodb.net/?appName=ttbcluster")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tên không được để trống"],
    minlength: [2, "Tên phải có ít nhất 2 ký tự"],
  },
  age: {
    type: Number,
    required: [true, "Tuổi không được để trống"],
    min: [0, "Tuổi phải >= 0"],
  },
  email: {
    type: String,
    required: [true, "Email không được để trống"],
    match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    unique: true,
  },
  address: {
    type: String,
  },
});

const User = mongoose.model("User", UserSchema);

// Ensure indexes are created (including unique email)
User.init().catch((err) => console.error("MongoDB Index Error:", err));
//giao diện swagger 
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Users API",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            age: { type: "number" },
            email: { type: "string" },
            address: { type: "string" },
          },
        },
        CreateUserInput: {
          type: "object",
          required: ["name", "age", "email"],
          properties: {
            name: { type: "string", example: "Nguyen Van A" },
            age: { type: "number", example: 20 },
            email: { type: "string", example: "a@example.com" },
            address: { type: "string", example: "Ha Noi" },
          },
        },
        UpdateUserInput: {
          type: "object",
          properties: {
            name: { type: "string", example: "Nguyen Van B" },
            age: { type: "number", example: 21 },
            email: { type: "string", example: "b@example.com" },
            address: { type: "string", example: "Da Nang" },
          },
        },
      },
    },
    paths: {
      "/users": {
        get: {
          summary: "List users",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1, minimum: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10, minimum: 1 },
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string", default: "" },
              description: "Search by name or email (case-insensitive)",
            },
          ],
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      totalPages: { type: "integer" },
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserInput" },
              },
            },
          },
          responses: {
            201: {
              description: "Created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/User" } },
              },
            },
            400: { description: "Validation Error" },
          },
        },
      },
      "/users/{id}": {
        put: {
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "id",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateUserInput" },
              },
            },
          },
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/User" } },
              },
            },
            400: { description: "Validation Error" },
            404: { description: "User not found" },
          },
        },
        delete: {
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "id",
            },
          ],
          responses: {
            200: { description: "Deleted" },
            400: { description: "Invalid id" },
            404: { description: "User not found" },
          },
        },
      },
    },
  },
  apis: [],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

app.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).skip(skip).limit(limitNumber),
    ]);

    const totalPages = Math.ceil(total / limitNumber);
    res.json({ total, totalPages, page: pageNumber, limit: limitNumber, users });
  }
  catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/users", async (req, res) => {
  try {
    const user = new User(req.body);        
    await user.save();
    res.status(201).json(user);
    }
    catch (err) {
    console.error("Error creating user:", err);
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      res.status(400).json({ error: "Validation Error", details: errors });
    } else if (err && err.code === 11000 && (err.keyPattern?.email || err.keyValue?.email)) {
      res.status(400).json({
        error: "Duplicate Email",
        details: ["Email đã tồn tại"],
      });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
    }
});


app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error updating user:", err);
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      res.status(400).json({ error: "Validation Error", details: errors });
    } else if (err && err.code === 11000 && (err.keyPattern?.email || err.keyValue?.email)) {
      res.status(400).json({
        error: "Duplicate Email",
        details: ["Email đã tồn tại"],
      });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Deleted", user });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});