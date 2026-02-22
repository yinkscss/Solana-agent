import { describe, test, expect, beforeEach } from "bun:test";
import { Counter, Gauge, Histogram, registry } from "../src/metrics";

describe("Counter", () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter({ name: "test_counter", help: "A test counter" });
  });

  test("starts at zero", () => {
    expect(counter.get()).toBe(0);
  });

  test("increments by 1 by default", () => {
    counter.inc();
    expect(counter.get()).toBe(1);
  });

  test("increments by arbitrary value", () => {
    counter.inc({}, 5);
    expect(counter.get()).toBe(5);
  });

  test("tracks labels independently", () => {
    counter.inc({ method: "GET" });
    counter.inc({ method: "POST" });
    counter.inc({ method: "GET" });

    expect(counter.get({ method: "GET" })).toBe(2);
    expect(counter.get({ method: "POST" })).toBe(1);
  });

  test("reset clears all values", () => {
    counter.inc({ method: "GET" }, 10);
    counter.reset();
    expect(counter.get({ method: "GET" })).toBe(0);
  });

  test("collects Prometheus text format", () => {
    counter.inc({ method: "GET", status: "200" }, 3);
    const output = counter.collect();

    expect(output).toContain("# HELP test_counter A test counter");
    expect(output).toContain("# TYPE test_counter counter");
    expect(output).toContain('test_counter{method="GET",status="200"} 3');
  });
});

describe("Gauge", () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge({ name: "test_gauge", help: "A test gauge" });
  });

  test("set and get without labels", () => {
    gauge.set(42);
    expect(gauge.get()).toBe(42);
  });

  test("set and get with labels", () => {
    gauge.set({ service: "api" }, 10);
    expect(gauge.get({ service: "api" })).toBe(10);
  });

  test("inc and dec", () => {
    gauge.inc();
    gauge.inc();
    gauge.dec();
    expect(gauge.get()).toBe(1);
  });

  test("collects Prometheus text format", () => {
    gauge.set(99);
    const output = gauge.collect();

    expect(output).toContain("# TYPE test_gauge gauge");
    expect(output).toContain("test_gauge 99");
  });
});

describe("Histogram", () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram({
      name: "test_histogram",
      help: "A test histogram",
      buckets: [0.1, 0.5, 1],
    });
  });

  test("observe records value in correct buckets", () => {
    histogram.observe(0.05);
    const output = histogram.collect();

    expect(output).toContain('test_histogram_bucket{le="0.1"} 1');
    expect(output).toContain('test_histogram_bucket{le="0.5"} 1');
    expect(output).toContain('test_histogram_bucket{le="1"} 1');
    expect(output).toContain('test_histogram_bucket{le="+Inf"} 1');
    expect(output).toContain("test_histogram_sum 0.05");
    expect(output).toContain("test_histogram_count 1");
  });

  test("observe only increments matching buckets", () => {
    histogram.observe(0.3);
    const output = histogram.collect();

    expect(output).toContain('test_histogram_bucket{le="0.1"} 0');
    expect(output).toContain('test_histogram_bucket{le="0.5"} 1');
    expect(output).toContain('test_histogram_bucket{le="1"} 1');
  });

  test("multiple observations accumulate", () => {
    histogram.observe(0.05);
    histogram.observe(0.3);
    histogram.observe(0.8);
    histogram.observe(5);

    const output = histogram.collect();

    expect(output).toContain('test_histogram_bucket{le="0.1"} 1');
    expect(output).toContain('test_histogram_bucket{le="0.5"} 2');
    expect(output).toContain('test_histogram_bucket{le="1"} 3');
    expect(output).toContain('test_histogram_bucket{le="+Inf"} 4');
    expect(output).toContain("test_histogram_count 4");
  });

  test("observe with labels", () => {
    histogram.observe({ method: "GET" }, 0.05);
    const output = histogram.collect();

    expect(output).toContain('test_histogram_bucket{method="GET",le="0.1"} 1');
    expect(output).toContain('test_histogram_sum{method="GET"} 0.05');
    expect(output).toContain('test_histogram_count{method="GET"} 1');
  });

  test("collects Prometheus text format headers", () => {
    histogram.observe(0.1);
    const output = histogram.collect();

    expect(output).toContain("# HELP test_histogram A test histogram");
    expect(output).toContain("# TYPE test_histogram histogram");
  });
});

describe("Registry", () => {
  beforeEach(() => {
    registry.reset();
  });

  test("collect aggregates all registered metrics", () => {
    const output = registry.collect();
    expect(output).toContain("http_requests_total");
    expect(output).toContain("http_request_duration_seconds");
    expect(output).toContain("policy_eval_duration_seconds");
    expect(output).toContain("tx_signing_duration_seconds");
    expect(output).toContain("active_agents_total");
    expect(output).toContain("active_ws_connections");
  });

  test("output ends with newline", () => {
    const output = registry.collect();
    expect(output.endsWith("\n")).toBe(true);
  });
});
