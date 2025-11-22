import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * CandlestickChart Component
 * Displays price history with trading signal markers
 *
 * @param {Object} props
 * @param {Array} props.priceData - Historical price data [{timestamp, open, high, low, close}]
 * @param {Array} props.signals - Trading signals [{timestamp, signal, confidence, entryPrice}]
 * @param {string} props.pair - Currency pair name (e.g., "EUR/USD")
 * @param {string} props.timeframe - Timeframe (e.g., "1h", "1d")
 */
const CandlestickChart = ({ priceData = [], signals = [], pair = '', timeframe = '1h' }) => {
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    // Always generate mock data for now (yfinance API unavailable)
    // TODO: Switch to real data when backend API is ready
    const mockData = generateMockData(100);
    prepareChartData(mockData, signals);
  }, [signals, pair, timeframe]);

  /**
   * Generate mock price data for demonstration
   */
  const generateMockData = (count) => {
    const data = [];
    const basePrice = pair.includes('JPY') ? 145.5 : 1.0850;
    const now = new Date();

    for (let i = count; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 3600000); // 1 hour intervals
      const randomChange = (Math.random() - 0.5) * 0.01;
      const price = basePrice + randomChange;

      data.push({
        timestamp: timestamp.toISOString(),
        open: price - Math.random() * 0.005,
        high: price + Math.random() * 0.008,
        low: price - Math.random() * 0.008,
        close: price,
      });
    }

    return data;
  };

  /**
   * Prepare chart data from price history and signals
   */
  const prepareChartData = (prices, tradingSignals) => {
    // Extract timestamps and close prices
    const timestamps = prices.map(p => {
      const date = new Date(p.timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    const closePrices = prices.map(p => p.close);
    const highPrices = prices.map(p => p.high);
    const lowPrices = prices.map(p => p.low);

    // Prepare signal markers
    const buySignals = [];
    const sellSignals = [];

    tradingSignals.forEach(signal => {
      const signalTime = new Date(signal.timestamp || signal.createdAt);
      const signalPrice = signal.entryPrice || signal.entry_price;

      // Find closest timestamp in price data
      const closestIndex = findClosestTimestampIndex(signalTime, prices);

      if (closestIndex !== -1 && signalPrice) {
        const marker = {
          x: timestamps[closestIndex],
          y: signalPrice,
          confidence: signal.confidence,
        };

        if (signal.signal === 'buy' || signal.action === 'buy') {
          buySignals.push(marker);
        } else if (signal.signal === 'sell' || signal.action === 'sell') {
          sellSignals.push(marker);
        }
      }
    });

    const data = {
      labels: timestamps,
      datasets: [
        // Price line
        {
          label: 'Close Price',
          data: closePrices,
          borderColor: 'rgba(99, 102, 241, 1)', // Indigo
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        // High prices (subtle)
        {
          label: 'High',
          data: highPrices,
          borderColor: 'rgba(139, 92, 246, 0.3)', // Light purple
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
        },
        // Low prices (subtle)
        {
          label: 'Low',
          data: lowPrices,
          borderColor: 'rgba(139, 92, 246, 0.3)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
        },
        // Buy signals
        {
          label: 'Buy Signal',
          data: buySignals,
          borderColor: 'rgba(34, 197, 94, 1)', // Green
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          pointRadius: 8,
          pointHoverRadius: 12,
          showLine: false,
          pointStyle: 'triangle',
        },
        // Sell signals
        {
          label: 'Sell Signal',
          data: sellSignals,
          borderColor: 'rgba(239, 68, 68, 1)', // Red
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          pointRadius: 8,
          pointHoverRadius: 12,
          showLine: false,
          pointStyle: 'triangle',
          rotation: 180,
        },
      ],
    };

    setChartData(data);
  };

  /**
   * Find closest timestamp index in price data
   */
  const findClosestTimestampIndex = (targetTime, prices) => {
    let closestIndex = -1;
    let minDiff = Infinity;

    prices.forEach((price, index) => {
      const priceTime = new Date(price.timestamp);
      const diff = Math.abs(priceTime.getTime() - targetTime.getTime());

      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: {
            size: 12,
          },
          usePointStyle: true,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: `${pair} - ${timeframe} Chart`,
        color: 'rgba(255, 255, 255, 0.9)',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: 'rgba(255, 255, 255, 1)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(99, 102, 241, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(5);
            }

            // Add confidence for signal markers
            if (context.raw && context.raw.confidence) {
              label += ` (${(context.raw.confidence * 100).toFixed(0)}% confidence)`;
            }

            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          maxTicksLimit: 10,
          font: {
            size: 10,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          callback: function(value) {
            return value.toFixed(5);
          },
        },
      },
    },
  };

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-96 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
        <div className="text-white/60">Loading chart data...</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
      <div style={{ height: '500px' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>

      {/* Chart Legend Info */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-white/60">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Buy Signal ({signals.filter(s => s.signal === 'buy' || s.action === 'buy').length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Sell Signal ({signals.filter(s => s.signal === 'sell' || s.action === 'sell').length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span>Hold Signal ({signals.filter(s => s.signal === 'hold' || s.action === 'hold').length})</span>
        </div>
      </div>
    </div>
  );
};

export default CandlestickChart;
