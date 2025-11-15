const path = require("path");

// Mock global pour path.resolve et path.basename
jest.mock("path", () => ({
  ...jest.requireActual("path"), // Garde les implémentations réelles pour les autres fonctions de path
  resolve: jest.fn((...args) => args.join("/")),
  basename: jest.fn((p, ext) => {
    const parts = p.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return ext ? filename.replace(ext, "") : filename;
  }),
}));

// Mock global pour dotenv.config
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));
