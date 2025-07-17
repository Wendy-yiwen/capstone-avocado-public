module.exports = {
    transform: {
      "^.+\\.(js|jsx)$": "babel-jest",
    },
    transformIgnorePatterns: [
      "/node_modules/(?!axios)/",  // Make Jest convert axios
    ],
    moduleNameMapper: {
      "\\.(jpg|jpeg|png|gif|svg)$": "<rootDir>/__mocks__/fileMock.js",
      "\\.(css|scss)$": "identity-obj-proxy"
    },
    testEnvironment: "jsdom",
  };
  