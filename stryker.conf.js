module.exports = function(config) {
  config.set({
    testRunner: 'mocha',
    mutator: 'typescript',
    transpilers: ['typescript'],
    reporters: ['html', 'baseline', 'clear-text', 'progress', 'dashboard'],
    packageManager: 'npm',
    testFramework: 'mocha',
    coverageAnalysis: 'perTest',
    tsconfigFile: 'tsconfig.json',
    mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
    mochaOptions: {
      files: ['src/**/*.test.js']
    }
  });
};
