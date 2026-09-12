/**
 * Architecture & Technical Implementation Plan Specifications
 * Senior Quantitative Architect blueprint for Web, Android, and iOS.
 */

export interface ArchitectureModule {
  id: string;
  name: string;
  tier: 'Data Ingestion' | 'Execution Core' | 'Analytics & Optuna' | 'Client Layer' | 'Infrastructure';
  techStack: string[];
  throughputSLA: string;
  latencySLA: string;
  description: string;
  responsibilities: string[];
}

export const SYSTEM_MODULES: ArchitectureModule[] = [
  {
    id: 'market-data-gateway',
    name: 'Market Data Ingestion & Tick Normalizer',
    tier: 'Data Ingestion',
    techStack: ['Go / C++', 'gRPC', 'Apache Kafka', 'FIX 4.4', 'FlatBuffers'],
    throughputSLA: '250,000 ticks/sec',
    latencySLA: '< 250 microseconds',
    description:
      'Aggregates multi-broker L1/L2 pricing feeds (GKFX, LMAX, FXCM, Currenex), normalizes currency pairs, and broadcasts to internal ring buffers.',
    responsibilities: [
      'Multi-feed FIX 4.4 connection pooling & heartbeat monitoring',
      'Dynamic bid/ask spread modeling and liquidity session adjustments',
      'Tick deduplication, outlier rejection, and synthetic cross-rate calculation',
      'High-throughput publishing to Kafka/Aeron low-latency message bus',
    ],
  },
  {
    id: 'broker-matching-engine',
    name: 'Broker Simulation & Ledger Matching Engine',
    tier: 'Execution Core',
    techStack: ['Rust / C++', 'In-Memory State Machine', 'Redis Sentinel', 'PostgreSQL'],
    throughputSLA: '50,000 orders/sec',
    latencySLA: '< 1.2 milliseconds',
    description:
      'Simulates institutional broker environment (mirroring GKFX ECN demo behavior) with instant execution, pending order triggers, margin evaluation, and automated liquidation.',
    responsibilities: [
      'Real-time position lifecycle management (Market, Limit, Stop, Trailing Stop)',
      'Sub-millisecond margin requirement and free margin calculation',
      'Automated Margin Call warnings (100%) and Stop-Out liquidations (50%)',
      'Transaction cost modeling: Commission per lot ($3.50/side) and overnight swap rollover',
      'Realistic volatility-based slippage engine',
    ],
  },
  {
    id: 'optuna-wfo-cluster',
    name: 'Distributed Walk-Forward Optimization & Optuna Cluster',
    tier: 'Analytics & Optuna',
    techStack: ['Python 3.12', 'Optuna (TPE)', 'Ray Core', 'Numba / Polars', 'Redis Queue'],
    throughputSLA: '1,000 parameter trials/sec',
    latencySLA: 'Batch / Interactive (1-5s)',
    description:
      'Executes Tree-structured Parzen Estimator (TPE) Bayesian hyperparameter search over rolling In-Sample (IS) and Out-of-Sample (OOS) data windows to prevent overfitting.',
    responsibilities: [
      'Walk-forward time-series window generation (expanding / rolling folds)',
      'Hyperparameter search over restricted allowed technical indicators (EMA, RSI, MACD, BB, ATR, S&R)',
      'Walk-Forward Efficiency (WFE) score calculation to penalize overfitted curve-fits',
      'Trial pruning using MedianPruner for rapid convergence',
      'Parameter sensitivity and ANOVA variance decomposition',
    ],
  },
  {
    id: 'historical-data-warehouse',
    name: 'Time-Series Tick & OHLC Warehouse',
    tier: 'Infrastructure',
    techStack: ['ClickHouse', 'Apache Arrow / Parquet', 'S3 Object Storage', 'Zstandard'],
    throughputSLA: '1.2 GB/sec sequential scan',
    latencySLA: '< 15 milliseconds query latency',
    description:
      'Columnar storage engine optimized for financial time-series, storing tick-by-tick and multi-timeframe OHLC candles (M1, M5, M15, H1, H4, D1).',
    responsibilities: [
      'Fast vectorized candle aggregation from raw ticks',
      'Ultra-dense compression (10:1 ratio on tick data with Zstandard)',
      'Partitioning by symbol and trading date for zero-disk-waste lookups',
    ],
  },
  {
    id: 'client-api-gateway',
    name: 'Real-Time WebSocket & API Gateway',
    tier: 'Client Layer',
    techStack: ['Node.js / Go', 'WebSockets (ws)', 'gRPC-Web', 'JWT / OAuth2'],
    throughputSLA: '100,000 concurrent sockets',
    latencySLA: '< 8 milliseconds round-trip',
    description:
      'Provides persistent bidirectional WebSocket channels for streaming quotes, account balance updates, order tickets, and backtest results.',
    responsibilities: [
      'Multiplexed symbol quote subscriptions with client-side throttling (up to 30Hz)',
      'Binary Protobuf/FlatBuffers serialization for 75% bandwidth reduction',
      'Rate-limiting and DDoS protection per demo trading account',
    ],
  },
];

export interface MobileArchitectureSpec {
  framework: string;
  recommendation: string;
  advantages: string[];
  renderingApproach: string;
  dataSyncStrategy: string;
  offlineCapabilities: string;
  pushNotifications: string;
  sampleCode: string;
}

export const MOBILE_ARCHITECTURE_SPEC: MobileArchitectureSpec = {
  framework: 'Kotlin Multiplatform (KMP) + Jetpack Compose (Android) & SwiftUI (iOS)',
  recommendation:
    'For high-performance quantitative trading terminals, we architect with Kotlin Multiplatform (KMP) for shared broker ledger math, indicator calculations, and WebSocket state, paired with native Jetpack Compose & SwiftUI for buttery 120Hz chart rendering.',
  advantages: [
    'Zero-overhead native performance on iOS (Metal) and Android (Vulkan)',
    '100% shared mathematical models (P&L calculations, margin requirements, TPE optimizer bindings)',
    'Direct access to low-level OS networking APIs (NWConnection on iOS, OkHttp/Ktor on Android)',
    'Seamless background push notification handling with zero memory leak risk',
  ],
  renderingApproach:
    'Custom high-performance canvas rendering pipeline capable of streaming 60-120 fps candlestick charts with interactive pinch-to-zoom, pan, and real-time bid/ask order book overlays.',
  dataSyncStrategy:
    'Bidirectional WebSocket channel using binary Protocol Buffers. When app transitions to background, tick stream throttles to 1Hz or disconnects with instant catch-up sync on resume.',
  offlineCapabilities:
    'Local SQLite / Room (Android) & SwiftData (iOS) storage holding 10,000 candles per symbol. Users can configure and dry-run backtests offline.',
  pushNotifications:
    'Firebase Cloud Messaging (FCM) & Apple Push Notification service (APNs) triggered by the Risk Engine: Margin Call warnings (<100%), Stop-Out liquidations (<50%), and SL/TP triggers.',
  sampleCode: `// Shared KMP Engine: Dynamic Broker Ledger Calculator
class BrokerLedgerCalculator(val leverage: Double) {
    fun calculateFloatingPnL(
        side: OrderSide,
        openPrice: Double,
        currentPrice: Double,
        lots: Double,
        contractSize: Double
    ): Double {
        val diff = if (side == OrderSide.BUY) currentPrice - openPrice else openPrice - currentPrice
        return diff * lots * contractSize
    }

    fun calculateMarginLevel(equity: Double, marginUsed: Double): Double {
        return if (marginUsed > 0.0) (equity / marginUsed) * 100.0 else 0.0
    }
}`,
};
