import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Search,
  BarChart2,
  Radio,
  MessageSquare,
  ShieldAlert,
  Terminal,
  Play,
  Square,
  RefreshCw,
  Eye,
  Bell,
  Wifi,
  WifiOff,
  Menu,
  X
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Types & Mock Data
// -----------------------------------------------------------------------------

type Platform = 'weibo' | 'wechat' | 'douyin' | 'redbook' | 'zhihu' | 'toutiao';
type Sentiment = 'positive' | 'neutral' | 'negative';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface DataItem {
  id: string;
  platform: Platform;
  author: string;
  content: string;
  timestamp: number;
  sentiment: Sentiment;
  riskLevel: RiskLevel;
  keywords: string[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

const SAMPLE_KEYWORDS = ['产品质量', '退款', '甚至', '投诉', '维权', '避雷'];

// -----------------------------------------------------------------------------
// Network Configuration (Zeabur / Cloud Ready)
// -----------------------------------------------------------------------------
const getWebSocketUrl = () => {
  // Production Environment Variable
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) return envUrl;

  if (typeof window === 'undefined') return 'ws://localhost:8000/ws';

  // 2. Automatic Fallback (Local Dev or Same-Origin Proxy)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'ws://localhost:8000/ws';
  }

  // Default assumption: Backend on :8000 unless proxied
  return `${protocol}//${host}:8000/ws`;
};

// -----------------------------------------------------------------------------
// Simulation Helpers
// -----------------------------------------------------------------------------
const generateMockPost = (keywords: string[]): DataItem => {
  const platforms: Platform[] = ['weibo', 'wechat', 'douyin', 'redbook', 'zhihu', 'toutiao'];
  const brands = ['某品牌', 'X公司', '我们的服务'];

  const selectedKeyword = keywords[Math.floor(Math.random() * keywords.length)] || '通用';

  const riskRaw = Math.random();
  let risk: RiskLevel = 'low';
  let sentiment: Sentiment = 'neutral';

  if (riskRaw > 0.8) { risk = 'high'; sentiment = 'negative'; }
  else if (riskRaw > 0.6) { risk = 'medium'; sentiment = 'negative'; }
  else if (riskRaw < 0.2) { sentiment = 'positive'; }

  return {
    id: Math.random().toString(36).substr(2, 9),
    platform: platforms[Math.floor(Math.random() * platforms.length)],
    author: `SimUser_${Math.floor(Math.random() * 1000)}`,
    content: `[模拟数据] ${brands[Math.floor(Math.random() * brands.length)]}在${selectedKeyword}方面存在问题...`,
    timestamp: Date.now(),
    sentiment,
    riskLevel: risk,
    keywords: [selectedKeyword]
  };
};

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  const colors = {
    weibo: 'text-red-500',
    wechat: 'text-green-500',
    douyin: 'text-gray-100',
    redbook: 'text-red-400',
    zhihu: 'text-blue-500',
    toutiao: 'text-orange-500'
  };
  const labels = { weibo: '微博', wechat: '微信', douyin: '抖音', redbook: '小红书', zhihu: '知乎', toutiao: '头条' };
  return <span className={`font-bold ${colors[platform]}`}>{labels[platform]}</span>;
};

const RiskBadge = ({ level }: { level: RiskLevel }) => {
  const styles = {
    low: 'bg-green-900/30 text-green-400 border-green-800',
    medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    high: 'bg-orange-900/30 text-orange-400 border-orange-800',
    critical: 'bg-red-900/30 text-red-500 border-red-800 animate-pulse'
  };
  return <span className={`px-2 py-0.5 text-xs border rounded uppercase tracking-wider ${styles[level]}`}>{level} Risk</span>;
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function SocialMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(SAMPLE_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [feed, setFeed] = useState<DataItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, negative: 0, highRisk: 0 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-49), {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  }, []);

  // 1. WebSocket Logic
  useEffect(() => {
    const connectWS = () => {
      try {
        const url = getWebSocketUrl();
        // console.log("Attempting WS Connection:", url);
        const ws = new WebSocket(url);

        ws.onopen = () => {
          setIsConnected(true);
          addLog(`Connected to Backend: ${url}`, 'success');
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
        };

        ws.onmessage = (event) => {
          try {
            const data: DataItem = JSON.parse(event.data);
            handleNewData(data);
          } catch (e) {
            console.error('Parse error', e);
          }
        };

        wsRef.current = ws;
      } catch (e) {
        setIsConnected(false);
      }
    };

    connectWS();
    return () => { wsRef.current?.close(); };
  }, [addLog]);

  // 2. Data Handler
  const handleNewData = useCallback((newItem: DataItem) => {
    const logMsg = `[${newItem.id.startsWith('real') ? 'LIVE' : 'SIM'}] ${newItem.platform}::${newItem.id}`;
    addLog(logMsg, newItem.riskLevel === 'critical' ? 'warning' : 'info');

    setFeed(prev => [newItem, ...prev].slice(0, 100));
    setStats(prev => ({
      total: prev.total + 1,
      negative: prev.negative + (newItem.sentiment === 'negative' ? 1 : 0),
      highRisk: prev.highRisk + (['high', 'critical'].includes(newItem.riskLevel) ? 1 : 0)
    }));

    if (newItem.riskLevel === 'critical') {
      addLog(`!!! ALERT: High Risk Content Detected`, 'error');
    }
  }, [addLog]);

  // 3. Fallback Simulation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && !isConnected) {
      interval = setInterval(() => handleNewData(generateMockPost(keywords)), 1500);
    }
    return () => clearInterval(interval);
  }, [isRunning, isConnected, keywords, handleNewData]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Actions
  const handleAddKeyword = () => {
    if (newKeyword && !keywords.includes(newKeyword)) {
      const updated = [...keywords, newKeyword];
      setKeywords(updated);
      setNewKeyword('');
      addLog(`Added keyword "${newKeyword}"`, 'success');
      if (isConnected && wsRef.current) wsRef.current.send(JSON.stringify({ type: 'UPDATE_KEYWORDS', keywords: updated }));
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    setKeywords(updated);
    if (isConnected && wsRef.current) wsRef.current.send(JSON.stringify({ type: 'UPDATE_KEYWORDS', keywords: updated }));
  };

  const toggleSystem = () => {
    const nextState = !isRunning;
    setIsRunning(nextState);
    addLog(nextState ? 'System Startup Sequence Initiated...' : 'System Halt Sequence Initiated...', 'info');
    if (isConnected && wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: nextState ? 'START' : 'STOP', keywords: keywords }));
    }
  };

  // ---------------------------------------------------------------------------
  // UI Structure
  // ---------------------------------------------------------------------------

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
          <Eye className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">OMNI-MONITOR</span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <div className="px-4 py-2 bg-indigo-600/10 text-indigo-400 rounded border border-indigo-600/20 flex items-center gap-3 cursor-pointer">
          <Activity size={18} />
          <span className="font-medium">实时监控</span>
        </div>
        <div className="px-4 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded flex items-center gap-3 cursor-pointer transition-colors">
          <BarChart2 size={18} />
          <span>舆情分析</span>
        </div>
        <div className="px-4 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded flex items-center gap-3 cursor-pointer transition-colors">
          <ShieldAlert size={18} />
          <span>危机预警</span>
        </div>
      </nav>

      <div className={`p-4 border-t border-slate-800 text-xs font-mono flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-slate-500'}`}>
        {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
        {isConnected ? 'BACKEND: CONNECTED' : 'BACKEND: DISCONNECTED'}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 flex overflow-hidden">

      {/* Desktop Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex-col hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar (Overlay) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-left">
            <div className="absolute top-4 right-4 text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </div>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">

        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button - Ensure high z-index and touch target */}
            <button className="md:hidden text-slate-400 p-2 -ml-2 hover:bg-slate-800 rounded" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>

            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-mono text-xs md:text-sm text-slate-400">
              {isRunning ? 'ACTIVE' : 'IDLE'} | {isConnected ? 'LIVE' : 'SIM'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white relative">
              <Bell size={20} />
              {stats.highRisk > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-lg">
                <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Total</div>
                <div className="text-xl md:text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-lg">
                <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Negative</div>
                <div className="text-xl md:text-2xl font-bold text-yellow-500">{stats.negative.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-lg">
                <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Risk</div>
                <div className="text-xl md:text-2xl font-bold text-red-500">{stats.highRisk.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 md:p-4 rounded-lg flex items-center">
                <button
                  onClick={toggleSystem}
                  className={`w-full h-full py-2 rounded flex items-center justify-center gap-2 font-bold transition-all text-sm md:text-base ${isRunning
                    ? 'bg-red-900/20 text-red-500 border border-red-900'
                    : 'bg-green-600 text-white'
                    }`}
                >
                  {isRunning ? <Square size={16} /> : <Play size={16} />}
                  {isRunning ? 'STOP' : 'START'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column: Config */}
              <div className="flex flex-col gap-6 order-2 lg:order-1">

                {/* Keywords */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-300 flex items-center gap-2 text-sm md:text-base">
                      <Search size={16} /> 关键词池
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                      placeholder="Add keyword..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <button onClick={handleAddKeyword} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {keywords.map(kw => (
                      <span key={kw} className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs border border-slate-700 flex items-center gap-2">
                        {kw}
                        <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-400">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Logs */}
                <div className="bg-black border border-slate-800 rounded-lg p-4 h-48 md:h-auto flex-1 flex flex-col font-mono text-xs overflow-hidden shadow-inner shadow-black">
                  <div className="text-slate-500 border-b border-slate-800 pb-2 mb-2 flex items-center gap-2">
                    <Terminal size={14} /> LOGS
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {logs.map(log => (
                      <div key={log.id} className="break-all">
                        <span className="text-slate-600 mr-2">[{log.timestamp.split(' ')[0]}]</span>
                        <span className={`${log.type === 'error' ? 'text-red-500' :
                          log.type === 'warning' ? 'text-yellow-500' :
                            log.type === 'success' ? 'text-green-500' : 'text-slate-400'
                          }`}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>

              {/* Right Column: Feed */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden h-[500px] md:h-[600px] order-1 lg:order-2">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur">
                  <h3 className="font-bold text-slate-300 flex items-center gap-2 text-sm md:text-base">
                    <Radio size={16} className={isRunning ? 'text-green-500 animate-pulse' : 'text-slate-600'} />
                    实时数据流
                  </h3>
                  <button className="p-1 hover:bg-slate-800 rounded text-slate-400"><RefreshCw size={14} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
                  {feed.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                      <Activity size={48} className="mb-4 opacity-20" />
                      <p className="text-sm">等待数据...</p>
                    </div>
                  )}
                  {feed.map((item) => (
                    <div key={item.id} className={`bg-slate-900 border-l-4 rounded p-3 md:p-4 shadow-sm ${item.riskLevel === 'critical' ? 'border-red-600 bg-red-900/10' :
                      item.riskLevel === 'high' ? 'border-orange-500' :
                        item.riskLevel === 'medium' ? 'border-yellow-500' :
                          'border-indigo-500'
                      }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 md:gap-3">
                          <PlatformIcon platform={item.platform} />
                          <span className="text-slate-500 text-xs font-mono hidden md:inline">{item.author}</span>
                        </div>
                        <RiskBadge level={item.riskLevel} />
                      </div>
                      <p className="text-slate-300 text-sm mb-3 line-clamp-2">{item.content}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={`flex items-center gap-1 ${item.sentiment === 'negative' ? 'text-red-400' : 'text-slate-400'
                          }`}>
                          <MessageSquare size={12} />
                          {item.sentiment}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
