/**
 */
class JsonReporter {
  /**
   * @param {import("@jest/reporters").Test} test
   * @param {import("@jest/test-result").TestResult} _testResult
   * @param {import("@jest/test-result").AggregatedResult} _aggregatedResult
   * @return {Promise<void> | void}
   */
  onTestResult(test, _testResult, _aggregatedResult) {
    console.log(`Test complete ${test.path}`);
  }

  /**
   * @param {import("@jest/test-result").AggregatedResult} _results
   * @param {import("@jest/reporters").ReporterOnStartOptions} _options
   * @return {Promise<void> | void}
   */
  onRunStart(_results, _options) {
    console.log("Test run start");
  }

  /**
   * @param {import("@jest/reporters").Test} test
   * @return {Promise<void> | void}
   */
  onTestStart(test) {
    console.log(`Test start ${test.path}`);
  }

  /**
   * @param {Set<import("@jest/reporters").Context>} _contexts
   * @param {import("@jest/test-result").AggregatedResult} _results
   * @return {Promise<void> | void}
   */
  onRunComplete(_contexts, _results) {
    console.log("Test run complete.");
  }

  /**
   * @return {Error | void}
   */
  getLastError() {
    return;
  }
}

module.exports = JsonReporter;
