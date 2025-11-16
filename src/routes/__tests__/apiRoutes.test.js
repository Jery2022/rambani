const request = require("supertest");
const express = require("express");
const session = require("express-session");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const app = express();
const apiRoutes = require("../apiRoutes");

// Mock des middlewares et contrôleurs pour les tests
jest.mock("../../middleware/authMiddleware", () => ({
  isAuthenticatedChat: jest.fn((req, res, next) => {
    req.user = { _id: "60c72b2f9b1e8b001c8e4d7a", role: "user" }; // Utilisateur mocké
    next();
  }),
  isAdmin: jest.fn((req, res, next) => {
    req.user = { _id: "60c72b2f9b1e8b001c8e4d7b", role: "admin" }; // Admin mocké
    next();
  }),
  isAuthenticated: jest.fn((req, res, next) => {
    req.user = { _id: "60c72b2f9b1e8b001c8e4d7b", role: "admin" }; // Admin mocké
    next();
  }),
}));

jest.mock("../../middleware/uploadMiddleware", () => ({
  upload: {
    single: jest.fn(() => (req, res, next) => {
      req.file = { filename: "test-profile.png" }; // Fichier mocké
      next();
    }),
  },
}));

// Configuration de l'application Express pour les tests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuration de la session et CSRF pour les tests
app.use(
  session({
    secret: "test_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Pour les tests HTTP
  })
);
app.use(csrf({ cookie: true }));

// Middleware pour gérer les erreurs CSRF
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next(err);
});

app.use("/api", apiRoutes);

describe("API Routes Integration Tests - Minimal Setup", () => {
  let csrfToken;
  let agent;

  beforeAll(async () => {
    // Initialiser supertest agent pour maintenir la session et les cookies
    agent = request.agent(app);

    // Obtenir un jeton CSRF
    const res = await agent.get("/api/csrf-token");
    csrfToken = res.body.csrfToken;
  });

  test("devrait retourner un jeton CSRF", async () => {
    const res = await agent.get("/api/csrf-token");
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("csrfToken");
  });
});
