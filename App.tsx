
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole, AuditLog, ExpenseCategory, ReceiptStatus, ReceiptData, Employee, TruckAsset } from './types';
import { HOLIDAYS } from './constants';
import { extractReceiptData } from './lib/gemini';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Shared State Container ---
const useAppState = () => {
  const [users, setUsers] = useState<ManagedUser[]>([
    { 
      id: '1', 
      username: 'admin', 
      password: '1234', 
      role: UserRole.ADMIN, 
      fullName: 'Admin',
      access: { dashboard: true, receipts: true, team: true, trucks: true, fuel: true, crm: true, dispatching: true }
    },
    { 
      id: '2', 
      username: 'staff', 
      password: '1234', 
      role: UserRole.STAFF, 
      fullName: 'Operations Staff',
      access: { dashboard: true, receipts: true, team: false, trucks: true, fuel: true, crm: false, dispatching: true }
    }
  ]);

  const [team, setTeam] = useState<Employee[]>([
    { id: '1', fullName: 'Juan Dela Cruz', role: 'Driver', dayOff: 'Weekends' as any, phone: '0917-111-2222', licenseNumber: 'N01-12-345678', licenseType: 'Professional', licenseExpiration: '2025-06-15' },
    { id: '2', fullName: 'Mario Santos', role: 'Driver', dayOff: 'Monday', phone: '0917-333-4444', licenseNumber: 'N02-23-456789', licenseType: 'Professional', licenseExpiration: '2024-05-25' },
    { id: '3', fullName: 'Pedro Penduko', role: 'Helper', dayOff: 'Weekends' as any, phone: '0918-555-6666' },
  ]);

  const [trucks, setTrucks] = useState<TruckAsset[]>([
    { 
      id: '1',
      plate: 'NGS-7788', 
      vehicle_type: '6 WHEELER', 
      status: 'active', 
      health: 92,
      reg_expiry: '2024-11-20',
      last_pms_date: '2024-02-15',
      next_pms_date: '2024-08-15',
      last_pms_mileage: 45000,
      next_pms_mileage: 50000,
      created_at: new Date().toISOString()
    },
    { 
      id: '2',
      plate: 'WIK-902', 
      vehicle_type: 'FUSO CANTER • 6 WHEELER', 
      status: 'in_repair', 
      health: 45,
      reg_expiry: '2024-05-30',
      last_pms_date: '2024-01-10',
      next_pms_date: '2024-07-10',
      last_pms_mileage: 82000,
      next_pms_mileage: 87000,
      created_at: new Date().toISOString()
    }
  ]);

  const [receipts, setReceipts] = useState<AppReceipt[]>([
    { id: '1', receiptNo: 'SHL-99881', vendor: 'Shell Balintawak', date: '2024-05-18', driver: 'Juan Dela Cruz', category: 'fuel', amount: 4200.00, status: 'reviewed', tin: '123-456-789-000' },
  ]);

  const [dispatches, setDispatches] = useState<Dispatch[]>([
    {
      id: 'd1',
      customer_name: 'San Miguel Corp',
      pickup_address: 'Port Area, Manila',
      dropoff_address: 'Balintawak Warehouse',
      dispatch_date: new Date().toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '12:00',
      driver_id: '1',
      status: 'Scheduled',
      notes: 'Fragile cargo',
      created_at: new Date().toISOString()
    }
  ]);

  const [fuelEvents, setFuelEvents] = useState([
    { id: '1', time: '2024-05-19', truck: 'NGS-7788', liters: 84.5, startingOdo: 45200, status: 'Good' },
  ]);

  const [crmContacts, setCrmContacts] = useState([
    { id: '1', name: 'Robert Petron', company: 'Petron Corp Balintawak', phone: '0917-123-4567', tags: ['Vendor', 'Fuel'] },
  ]);

  return {
    users, setUsers,
    team, setTeam,
    trucks, setTrucks,
    receipts, setReceipts,
    dispatches, setDispatches,
    fuelEvents, setFuelEvents,
    crmContacts, setCrmContacts
  };
};

// --- Types Expansion ---
interface UserAccess {
  dashboard: boolean;
  receipts: boolean;
  team: boolean;
  trucks: boolean;
  fuel: boolean;
  crm: boolean;
  dispatching: boolean;
}

interface ManagedUser extends User {
  password?: string;
  access: UserAccess;
}

interface AppReceipt {
  id: string;
  receiptNo: string;
  vendor: string;
  date: string;
  driver: string;
  category: string;
  amount: number;
  status: string;
  tin?: string;
  documentType?: string;
}

export interface Dispatch {
  id: string;
  customer_name: string;
  pickup_address: string;
  dropoff_address: string;
  dispatch_date: string;
  start_time: string;
  end_time: string;
  driver_id: string | null;
  status: 'Scheduled' | 'On the way' | 'Delivered' | 'Cancelled';
  notes: string;
  created_at: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// --- Core Layout Components ---
const Sidebar: React.FC<{ user: ManagedUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const location = useLocation();
  const menuItems = [
    { path: '/', label: 'Overview', icon: '📊', key: 'dashboard' },
    { path: '/dispatching', label: 'Dispatching', icon: '🚚', key: 'dispatching' },
    { path: '/receipts', label: 'Receipts', icon: '🧾', key: 'receipts' },
    { path: '/team', label: 'Team', icon: '👷', key: 'team' },
    { path: '/trucks', label: 'Trucks', icon: '🚛', key: 'trucks' },
    { path: '/fuel', label: 'Fuel Monitor', icon: '⛽', key: 'fuel' },
    { path: '/crm', label: 'CRM', icon: '👥', key: 'crm' },
    { path: '/settings', label: 'Settings', icon: '⚙️', key: 'always' },
  ];

  return (
    <aside className="fixed left-4 top-4 bottom-4 w-64 bg-[#4361EE] text-white rounded-[2.5rem] shadow-2xl z-[100] overflow-hidden flex flex-col">
      <div className="p-8">
        <h1 className="text-xl font-black tracking-tighter uppercase">Shekinah</h1>
        <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.3em] mt-2">Management Console</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto hide-scrollbar">
        {menuItems.map((item) => {
          const hasAccess = item.key === 'always' || (user.access as any)[item.key];
          if (!hasAccess) return null;

          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-white text-[#4361EE] shadow-xl font-bold' 
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
              <span className="text-sm tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/10 flex flex-col gap-6">
        {/* User Profile in Sidebar */}
        <div className="flex items-center gap-4 bg-white p-3 pr-5 rounded-[2rem] shadow-lg group">
          <div className="w-10 h-10 bg-[#4361EE] rounded-xl flex items-center justify-center text-white font-black group-hover:scale-105 transition-transform">
            {user.fullName.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-slate-900 leading-none truncate">{user.username}</span>
            <span className="text-[9px] font-bold text-[#4361EE] uppercase tracking-[0.1em] mt-1">{user.role}</span>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full text-center text-white/50 text-[10px] font-black hover:text-white transition-colors uppercase tracking-[0.2em]"
        >
          Signout
        </button>
      </div>
    </aside>
  );
};

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Hello! I'm your Shekinah Operations Specialist. Need help navigating the fleet manager, AI receipt scanning, or dispatching?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      // Create new instance right before making the call as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: userMsg,
        config: {
          systemInstruction: "You are an expert tutor for the 'Shekinah Movers' logistics SaaS. This app features: 1. Overview Dashboard (Real-time spend and fuel), 2. Dispatching (Scheduling missions for drivers), 3. Receipt Intelligence (AI extraction of vendor, TIN, amount via Gemini), 4. Personnel Roster (Driver details and license expiry), 5. Fleet Asset Manager (Truck PMS, health, and registration expiry), 6. Fuel Monitor (Efficiency tracking), and 7. CRM. Be professional, helpful, and concise. Explain features and how to use them within the app interface."
        }
      });

      let fullAiText = '';
      setMessages(prev => [...prev, { role: 'ai', text: '' }]);

      for await (const chunk of streamResponse) {
        const c = chunk as GenerateContentResponse;
        fullAiText += c.text; // Use the property .text directly
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = fullAiText;
          return updated;
        });
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Apologies, I'm having trouble connecting to my neural network. Please try again in a moment." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#4361EE] rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[110] hover:scale-110 active:scale-95 transition-all animate-bounce-slow"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-8 w-96 h-[32rem] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.15)] rounded-[2.5rem] z-[110] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#4361EE] p-6 text-white">
            <h3 className="text-lg font-black uppercase tracking-tighter">System Specialist</h3>
            <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">AI Guided Operations Assistant</p>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 hide-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm font-medium ${
                  m.role === 'user' 
                    ? 'bg-slate-100 text-slate-900 rounded-tr-none' 
                    : 'bg-[#4361EE]/5 text-[#4361EE] rounded-tl-none border border-[#4361EE]/10'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#4361EE]/5 px-5 py-3 rounded-2xl rounded-tl-none animate-pulse flex gap-1">
                   <div className="w-1.5 h-1.5 bg-[#4361EE] rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-[#4361EE] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                   <div className="w-1.5 h-1.5 bg-[#4361EE] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50/50 border-t border-slate-100">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 focus-within:border-[#4361EE] transition-all"
            >
              <input 
                placeholder="How do I scan receipts?" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-4 py-2 text-sm font-medium outline-none bg-transparent"
              />
              <button 
                type="submit"
                disabled={isTyping}
                className="w-10 h-10 bg-[#4361EE] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50"
              >
                ➔
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const TopBar: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [visible, setVisible] = useState(true);
  const prevScrollY = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > prevScrollY.current && currentScrollY > 100) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      prevScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header 
      className={`fixed top-4 left-[18rem] right-4 h-24 z-50 flex items-center justify-end px-12 rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'
      }`}
    >
      <div className="flex flex-col items-end text-right">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{formattedTime}</h2>
        <p className="text-[10px] font-bold text-[#4361EE] uppercase tracking-[0.2em] mt-1.5">{formattedDate}</p>
      </div>
    </header>
  );
};

// --- Module Views ---

const Dashboard: React.FC<{ state: any }> = ({ state }) => {
  const totalSpend = state.receipts.reduce((a:any,b:any)=>a+b.amount,0);
  
  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Fleet Overview</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Real-time performance metrics.</p>
        </div>
        <button className="bg-white border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#4361EE] hover:border-[#4361EE] transition-all flex items-center gap-3 shadow-sm">
          <span>⚙️</span> Customize Dashboard
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          { label: 'Total Fleet Spend', val: `₱${totalSpend.toLocaleString()}`, trend: '+12% this week', color: '#4361EE', isPositive: true },
          { label: 'Fuel Consumed', val: '4,200 L', trend: '-4% efficiency', color: '#3FD9F1', isPositive: false },
          { label: 'Network Reach', val: `${state.crmContacts.length} Vendors`, trend: 'Growing connections', color: '#10B981', isPositive: true },
        ].map((card, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-xl transition-all duration-500 group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-6 rounded-full" style={{ background: card.color }}></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{card.label}</p>
            </div>
            <div className="text-3xl font-black text-slate-900 mb-2">{card.val}</div>
            <p className={`text-[11px] font-bold ${card.isPositive ? 'text-green-500' : 'text-red-400'} flex items-center gap-1`}>
              {card.trend}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dispatching: React.FC<{ state: any }> = ({ state }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState<Dispatch | null>(null);
  const drivers = state.team.filter((m: Employee) => m.role === 'Driver');

  const filteredDispatches = state.dispatches.filter((d: Dispatch) => d.dispatch_date === selectedDate);

  const handleSaveDispatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dispatchData: any = {
      customer_name: fd.get('customer') as string,
      pickup_address: fd.get('pickup') as string,
      dropoff_address: fd.get('dropoff') as string,
      dispatch_date: fd.get('date') as string,
      start_time: fd.get('start') as string,
      end_time: fd.get('end') as string,
      driver_id: fd.get('driver') as string || null,
      notes: fd.get('notes') as string,
    };

    if (editingDispatch) {
      state.setDispatches(state.dispatches.map((d: Dispatch) => 
        d.id === editingDispatch.id ? { ...d, ...dispatchData } : d
      ));
    } else {
      const newDispatch: Dispatch = {
        id: Math.random().toString(36).substr(2, 9),
        ...dispatchData,
        status: 'Scheduled',
        created_at: new Date().toISOString()
      };
      state.setDispatches([...state.dispatches, newDispatch]);
    }
    
    setIsModalOpen(false);
    setEditingDispatch(null);
  };

  const openEditModal = (d: Dispatch) => {
    setEditingDispatch(d);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dispatch Schedule</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Fleet deployment and task orchestration.</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white rounded-2xl px-6 py-4 text-sm font-black border border-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-[#4361EE]"
          />
          <button 
            onClick={() => { setEditingDispatch(null); setIsModalOpen(true); }} 
            className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="text-xl font-bold">+</span> New Dispatch
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        {filteredDispatches.length > 0 ? filteredDispatches.map((d: Dispatch) => (
          <div key={d.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 flex flex-col lg:flex-row justify-between items-center gap-8 group hover:shadow-xl transition-all duration-300 relative">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase px-3 py-1 bg-blue-100 text-blue-700 rounded-full tracking-widest">{d.status}</span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{d.customer_name}</h3>
                <button 
                  onClick={() => openEditModal(d)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-lg text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit Dispatch"
                >
                  ✏️
                </button>
              </div>
              <p className="text-sm font-bold text-slate-700">{d.pickup_address} <span className="text-slate-300 mx-2">→</span> {d.dropoff_address}</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</p>
                  <p className="text-xs font-black text-slate-900">{d.start_time} - {d.end_time}</p>
               </div>
               <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">📦</div>
            </div>
          </div>
        )) : (
          <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
            <p className="text-slate-400 font-black text-sm uppercase tracking-widest">No active dispatches for this date.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-10 text-center">
              {editingDispatch ? 'Modify Mission' : 'Assign New Mission'}
            </h3>
            <form onSubmit={handleSaveDispatch} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Customer Entity</label>
                <input name="customer" required defaultValue={editingDispatch?.customer_name || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Corporate Name" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Pickup Point</label>
                  <input name="pickup" required defaultValue={editingDispatch?.pickup_address || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Address" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Dropoff Point</label>
                  <input name="dropoff" required defaultValue={editingDispatch?.dropoff_address || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Address" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Date</label>
                   <input name="date" type="date" required className="w-full bg-slate-50 rounded-2xl px-4 py-5 text-sm font-black outline-none" defaultValue={editingDispatch?.dispatch_date || selectedDate} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Start</label>
                   <input name="start" type="time" required defaultValue={editingDispatch?.start_time || ''} className="w-full bg-slate-50 rounded-2xl px-4 py-5 text-sm font-black outline-none" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ETA</label>
                   <input name="end" type="time" required defaultValue={editingDispatch?.end_time || ''} className="w-full bg-slate-50 rounded-2xl px-4 py-5 text-sm font-black outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Personnel Assignment</label>
                <select name="driver" defaultValue={editingDispatch?.driver_id || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                  <option value="">Unassigned (Awaiting Review)</option>
                  {drivers.map((drv: Employee) => <option key={drv.id} value={drv.id}>{drv.fullName}</option>)}
                </select>
              </div>
              <div className="pt-8 flex justify-center gap-8">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingDispatch(null); }} className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">Abort</button>
                <button type="submit" className="bg-[#4361EE] text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30">
                  {editingDispatch ? 'Apply Changes' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Receipts: React.FC<{ state: any; user: ManagedUser }> = ({ state, user }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'selection' | 'processing' | 'review' | 'camera'>('selection');
  const [extractedResult, setExtractedResult] = useState<ReceiptData | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const filteredReceipts = useMemo(() => {
    if (activeTab === 'all') return state.receipts;
    return state.receipts.filter((r: AppReceipt) => r.status === activeTab);
  }, [state.receipts, activeTab]);

  const startCamera = async () => {
    setUploadMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Could not access camera.");
      setUploadMode('selection');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        runAIScan(dataUrl);
      }
    }
  };

  const runAIScan = async (imageToScan: string) => {
    setUploadMode('processing');
    setDuplicateWarning(null);
    setCapturedImage(imageToScan);
    try {
      const [header, data] = imageToScan.split(',');
      let mimeType = header.split(':')[1].split(';')[0];
      const result = await extractReceiptData(data, mimeType);
      
      const isDuplicate = state.receipts.some((r: AppReceipt) => 
        (r.vendor.toLowerCase() === result.vendor_name?.toLowerCase() && 
         r.date === result.receipt_date && 
         r.amount === result.total) ||
        (result.invoice_or_receipt_no && r.receiptNo === result.invoice_or_receipt_no)
      );

      if (isDuplicate) {
        setDuplicateWarning("Warning: A similar receipt with this value, vendor, or number already exists in our system.");
      }

      setExtractedResult(result);
      setUploadMode('review');
    } catch (err: any) {
      alert("AI extraction failed.");
      setUploadMode('selection');
    }
  };

  const handleManualSave = (formData: any) => {
    const newReceipt: AppReceipt = {
      id: Math.random().toString(36).substr(2, 9),
      receiptNo: formData.invoice_or_receipt_no || `REC-${Math.floor(Math.random()*10000)}`,
      vendor: formData.vendor_name || 'Generic Vendor',
      date: formData.receipt_date || new Date().toISOString().split('T')[0],
      driver: user.fullName,
      category: formData.suggested_category || 'other',
      amount: parseFloat(formData.total) || 0,
      status: 'reviewed',
      tin: formData.vendor_tin,
      documentType: formData.document_type
    };
    state.setReceipts([newReceipt, ...state.receipts]);
    setIsUploading(false);
    setUploadMode('selection');
    setCapturedImage(null);
  };

  return (
    <div className="p-8 mt-32 ml-72 h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Receipt Intelligence</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Autonomous document parsing and audit readiness.</p>
        </div>
        <button 
          onClick={() => { setIsUploading(true); setUploadMode('selection'); }} 
          className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
        >
          <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2"><span className="text-lg">+</span> Ingest Receipt</span>
        </button>
      </div>

      <div className="bg-white rounded-[3rem] flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-50">
        <div className="flex border-b border-slate-100 px-10 bg-slate-50/30">
          {(['all', 'pending', 'reviewed'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeTab === tab ? 'border-[#4361EE] text-[#4361EE]' : 'border-transparent text-slate-300'}`}>
              {tab} Records
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-10 hide-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                <th className="pb-8">Merchant Audit</th>
                <th className="pb-8 text-right">Value (PHP)</th>
                <th className="pb-8 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReceipts.map((r: AppReceipt) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-6">
                    <p className="text-sm font-black text-slate-900">{r.vendor}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.receiptNo} • {r.date} {r.tin ? `• TIN: ${r.tin}` : ''}</p>
                  </td>
                  <td className="py-6 text-sm font-black text-slate-900 text-right">₱{r.amount.toLocaleString()}</td>
                  <td className="py-6 text-right">
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${r.status === 'reviewed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isUploading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-lg z-[110] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">COMPLIANCE REVIEW</h3>
              <button onClick={() => { setIsUploading(false); stopCamera(); }} className="w-12 h-12 bg-white shadow-md border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-all hover:scale-110 active:scale-95">✕</button>
            </div>
            
            <div className="flex-1 p-12 overflow-y-auto hide-scrollbar bg-white">
              {uploadMode === 'selection' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 h-96">
                  <button 
                     onClick={() => fileInputRef.current?.click()} 
                     className="bg-white rounded-[3rem] flex flex-col items-center justify-center gap-6 border-[3px] border-slate-900 hover:bg-slate-50 transition-all group p-10"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">📄</div>
                    <div className="text-center px-6">
                      <span className="text-sm font-black uppercase tracking-widest text-slate-900">UPLOAD SCREENSHOT</span>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">Select from your digital archives.</p>
                    </div>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) fileToBase64(file).then(base64 => runAIScan(base64));
                    }} />
                  </button>

                  <button 
                     onClick={startCamera} 
                     className="bg-white rounded-[3rem] flex flex-col items-center justify-center gap-6 border-[3px] border-dashed border-slate-100 hover:border-[#4361EE] hover:bg-slate-50 transition-all group p-10"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">📸</div>
                    <div className="text-center px-6">
                      <span className="text-sm font-black uppercase tracking-widest text-slate-900">TAKE PHOTO</span>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">Use your device's back camera.</p>
                    </div>
                  </button>
                </div>
              )}

              {uploadMode === 'camera' && (
                <div className="h-96 flex flex-col items-center justify-center gap-6 animate-in zoom-in-95">
                  <div className="w-full max-w-sm aspect-[3/4] bg-black rounded-[2.5rem] overflow-hidden relative shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                      <button onClick={capturePhoto} className="w-14 h-14 bg-[#4361EE] rounded-full border-4 border-white flex items-center justify-center text-2xl shadow-lg active:scale-90 transition-all">📸</button>
                      <button onClick={() => { stopCamera(); setUploadMode('selection'); }} className="bg-white/20 backdrop-blur-md text-white px-6 rounded-full text-[10px] font-black uppercase tracking-widest">Cancel</button>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Align the receipt within the frame.</p>
                </div>
              )}
              
              {uploadMode === 'processing' && (
                <div className="h-96 flex flex-col items-center justify-center gap-6 text-center">
                   <div className="w-20 h-20 border-4 border-slate-100 border-t-[#4361EE] rounded-full animate-spin"></div>
                   <div className="space-y-3">
                     <p className="text-sm font-black text-slate-900 uppercase tracking-widest animate-pulse">Neural Audit In Progress</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Verifying merchant TIN and document validity...</p>
                   </div>
                </div>
              )}

              {uploadMode === 'review' && extractedResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4">
                  {/* Screenshot Preview */}
                  <div className="space-y-6">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Document Proof (Screenshot)</h4>
                     <div className="w-full aspect-[4/5] bg-slate-50 rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-inner group relative">
                        <img src={capturedImage || ''} alt="Receipt Proof" className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                           <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest">Preview Mode</span>
                        </div>
                     </div>
                  </div>

                  <form className="space-y-10" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleManualSave(Object.fromEntries(formData));
                  }}>
                    {duplicateWarning && (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-4">
                          <span className="text-xl">⚠️</span>
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{duplicateWarning}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Merchant Name</label>
                          <input name="vendor_name" defaultValue={extractedResult.vendor_name || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none border border-transparent focus:border-[#4361EE]" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tax ID (TIN)</label>
                          <input name="vendor_tin" defaultValue={extractedResult.vendor_tin || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none border border-transparent focus:border-[#4361EE]" placeholder="000-000-000-000" />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Invoice / Receipt No.</label>
                          <input name="invoice_or_receipt_no" defaultValue={extractedResult.invoice_or_receipt_no || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none border border-transparent focus:border-[#4361EE]" />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Subtotal</label>
                             <input name="subtotal" type="number" step="0.01" defaultValue={extractedResult.subtotal || 0} className="w-full bg-white rounded-xl px-4 py-3 text-sm font-black outline-none" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tax (VAT)</label>
                             <input name="tax" type="number" step="0.01" defaultValue={extractedResult.tax || 0} className="w-full bg-white rounded-xl px-4 py-3 text-sm font-black outline-none" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-[#4361EE] uppercase tracking-widest px-2">Total Payable</label>
                          <input name="total" type="number" step="0.01" defaultValue={extractedResult.total || 0} className="w-full bg-white rounded-xl px-6 py-5 text-lg font-black outline-none border-2 border-[#4361EE]/20" />
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Expense Allocation</label>
                       <select name="suggested_category" defaultValue={extractedResult.suggested_category || 'other'} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                          {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                       </select>
                    </div>

                    <div className="pt-10 flex justify-center items-center gap-10">
                      <button type="button" onClick={() => setUploadMode('selection')} className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors tracking-widest">Rescan Proof</button>
                      <button type="submit" className="bg-[#4361EE] text-white px-16 py-6 rounded-full font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/40 active:scale-95 transition-all">Confirm Audit</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Team: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'license'>('identity');
  const [editingMember, setEditingMember] = useState<Employee | null>(null);

  const handleSaveMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Partial<Employee> = {
      fullName: fd.get('fullName') as string,
      role: fd.get('role') as any,
      dayOff: fd.get('dayOff') as any,
      phone: fd.get('phone') as string,
      licenseNumber: fd.get('licenseNumber') as string,
      licenseType: fd.get('licenseType') as any,
      licenseExpiration: fd.get('licenseExpiration') as string,
    };

    if (editingMember) {
      state.setTeam(state.team.map((m: Employee) => m.id === editingMember.id ? { ...m, ...data } : m));
    } else {
      const newMember: Employee = {
        id: Math.random().toString(36).substr(2, 9),
        ...(data as Omit<Employee, 'id'>),
      };
      state.setTeam([...state.team, newMember]);
    }
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      state.setTeam(state.team.filter((m: Employee) => m.id !== id));
    }
  };

  const getExpirationStatus = (dateString?: string) => {
    if (!dateString) return null;
    const expDate = new Date(dateString);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Expired', color: 'text-red-600', bg: 'bg-red-100', icon: '🚨' };
    if (diffDays <= 30) return { label: `Expires in ${diffDays}d`, color: 'text-amber-600', bg: 'bg-amber-100', icon: '⚠️' };
    return null;
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="mb-10 flex justify-between items-center">
        <div>
          {/* Fixed syntax error: added missing opening tag '<' for h2 */}
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Personnel Roster</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Driver and operations staff management with compliance monitoring.</p>
        </div>
        <button 
          onClick={() => { setEditingMember(null); setActiveTab('identity'); setIsModalOpen(true); }}
          className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="text-xl font-bold">+</span> Enlist Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {state.team.map((m: Employee) => {
          const expStatus = getExpirationStatus(m.licenseExpiration);
          return (
            <div key={m.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {m.role === 'Driver' ? '🚛' : m.role === 'Helper' ? '📦' : '💼'}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] font-black uppercase px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{m.role}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingMember(m); setActiveTab('identity'); setIsModalOpen(true); }} className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-50 rounded-lg transition-colors" title="Edit Specs">✏️</button>
                    <button onClick={() => handleDeleteMember(m.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Personnel">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <h4 className="text-xl font-black text-slate-900 tracking-tight mb-1">{m.fullName}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Day Off: {m.dayOff}</p>
              
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Phone</span>
                  <span className="text-[11px] font-black text-slate-900">{m.phone}</span>
                </div>
                {m.licenseNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">License</span>
                    <span className="text-[11px] font-black text-slate-900">{m.licenseNumber}</span>
                  </div>
                )}
                {expStatus && (
                  <div className={`mt-2 flex items-center justify-center gap-2 py-2 rounded-xl ${expStatus.bg} ${expStatus.color} animate-pulse`}>
                    <span className="text-sm">{expStatus.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-[0.1em]">{expStatus.label}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 animate-in zoom-in-95 duration-300 relative">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-2 text-center">
              {editingMember ? 'Update Personnel Identity' : 'Personnel Induction'}
            </h3>
            <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-10">Credentialing and compliance audit.</p>
            
            <div className="flex justify-center gap-2 mb-10 bg-slate-50 p-1.5 rounded-2xl w-fit mx-auto border border-slate-100">
               <button onClick={() => setActiveTab('identity')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'identity' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Core Identity</button>
               <button onClick={() => setActiveTab('license')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'license' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>License Audit</button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-8">
              {activeTab === 'identity' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Full Legal Name</label>
                    <input name="fullName" required defaultValue={editingMember?.fullName || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Juan Dela Cruz" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Operational Role</label>
                      <select name="role" defaultValue={editingMember?.role || 'Driver'} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none appearance-none">
                        <option value="Driver">Driver / Fleet Operator</option>
                        <option value="Helper">Helper / Logistics Asst</option>
                        <option value="Staff">Back-office Staff</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Weekly Rest Day</label>
                      <select name="dayOff" defaultValue={editingMember?.dayOff || 'Weekends'} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekends'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Secure Contact Number</label>
                    <input name="phone" required defaultValue={editingMember?.phone || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="09xx-xxx-xxxx" />
                  </div>
                </div>
              )}

              {activeTab === 'license' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Driver's License Number</label>
                    <input name="licenseNumber" defaultValue={editingMember?.licenseNumber || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="X00-00-000000" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">License Classification</label>
                      <select name="licenseType" defaultValue={editingMember?.licenseType || 'Professional'} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                        <option value="Professional">Professional</option>
                        <option value="Non-Professional">Non-Professional</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Expiration Deadline</label>
                      <input name="licenseExpiration" type="date" defaultValue={editingMember?.licenseExpiration || ''} className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none border border-transparent focus:border-red-100 transition-all" />
                    </div>
                  </div>
                  <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4">
                     <span className="text-xl">🛡️</span>
                     <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider leading-relaxed">System will trigger automated alerts 30 days prior to license expiration to ensure uninterrupted operations.</p>
                  </div>
                </div>
              )}

              <div className="pt-8 flex justify-center gap-10">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingMember(null); }} className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors tracking-widest">Cancel Induction</button>
                <button type="submit" className="bg-[#4361EE] text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30 active:scale-95 transition-all">Confirm Credentials</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Trucks: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'maintenance' | 'remarks'>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveTruck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const data: Partial<TruckAsset> = {
        plate: fd.get('plate') as string,
        vehicle_type: fd.get('vehicle_type') as string,
        status: fd.get('status') as 'active' | 'in_repair',
        reg_expiry: fd.get('reg_expiry') as string,
        health: parseInt(fd.get('health') as string) || 0,
        last_pms_date: fd.get('last_pms_date') as string,
        next_pms_date: fd.get('next_pms_date') as string,
        last_pms_mileage: parseInt(fd.get('last_pms_mileage') as string) || 0,
        next_pms_mileage: parseInt(fd.get('next_pms_mileage') as string) || 0,
        parts_repaired: fd.get('parts_repaired') as string,
        date_repaired: fd.get('date_repaired') as string
      };

      if (!data.plate || !data.vehicle_type || !data.reg_expiry) {
        throw new Error("Essential fleet identifiers missing.");
      }

      if (editingTruck) {
        state.setTrucks(state.trucks.map((t: TruckAsset) => 
          t.id === editingTruck.id ? { ...t, ...data } : t
        ));
      } else {
        const newTruck: TruckAsset = {
          id: Math.random().toString(36).substr(2, 9),
          ...(data as Omit<TruckAsset, 'id' | 'created_at'>),
          created_at: new Date().toISOString(),
        };
        state.setTrucks([...state.trucks, newTruck]);
      }
      setIsModalOpen(false);
      setEditingTruck(null);
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTruck = (id: string) => {
    if (confirm("Are you sure you want to decommission this asset?")) {
      state.setTrucks(state.trucks.filter((t: TruckAsset) => t.id !== id));
    }
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Fleet Asset Manager</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Real-time mechanical health & compliance tracking.</p>
        </div>
        <button 
          onClick={() => { setEditingTruck(null); setActiveTab('identity'); setIsModalOpen(true); }}
          className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="text-xl font-bold">+</span> Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {state.trucks.map((truck: TruckAsset) => {
          const regExpired = new Date(truck.reg_expiry) < new Date();
          const pmsDue = truck.next_pms_date && new Date(truck.next_pms_date) < new Date();
          
          return (
            <div key={truck.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 transition-all hover:shadow-xl group relative overflow-hidden flex flex-col h-full">
              <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                  🚛
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setEditingTruck(truck); setActiveTab('identity'); setIsModalOpen(true); }}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-[#4361EE] hover:bg-blue-50 rounded-lg transition-all"
                    title="Edit specs"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDeleteTruck(truck.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Decommission asset"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                    truck.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {truck.status === 'active' ? 'Active' : 'In Repair'}
                  </span>
                </div>
              </div>

              <div className="mb-6 flex-1">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{truck.plate}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">• {truck.vehicle_type}</p>
              </div>

              <div className="space-y-4 border-t border-slate-50 pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Reg Expiry</span>
                  <span className={`text-[10px] font-black ${regExpired ? 'text-red-500' : 'text-slate-800'}`}>{truck.reg_expiry}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Next PMS</span>
                  <span className={`text-[10px] font-black ${pmsDue ? 'text-amber-500' : 'text-slate-800'}`}>{truck.next_pms_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Condition</span>
                  <span className={`text-[10px] font-black ${truck.health < 60 ? 'text-amber-500' : 'text-[#4361EE]'}`}>{truck.health}% Health</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-50">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">PMS Mileage Target</p>
                 <div className="flex items-center gap-3">
                    <p className="text-[10px] font-black text-slate-900">{truck.next_pms_mileage?.toLocaleString() || '--'} KM</p>
                    <div className="flex-1 h-1 bg-slate-50 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-200" style={{ width: '40%' }}></div>
                    </div>
                 </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-50 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${truck.health < 60 ? 'bg-amber-400' : 'bg-[#4361EE]'}`}
                  style={{ width: `${truck.health}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] p-12 animate-in zoom-in-95 duration-300 relative">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-2 text-center">
              {editingTruck ? 'Update Asset Specs' : 'Add Fleet Asset'}
            </h3>
            <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Asset mechanical and regulatory audit.</p>
            
            <div className="flex justify-center gap-2 mb-10 bg-slate-50 p-1.5 rounded-2xl w-fit mx-auto border border-slate-100 overflow-x-auto">
               <button onClick={() => setActiveTab('identity')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'identity' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Base Identity</button>
               <button onClick={() => setActiveTab('maintenance')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'maintenance' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Maintenance (PMS)</button>
               <button onClick={() => setActiveTab('remarks')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'remarks' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Remarks</button>
            </div>

            <form onSubmit={handleSaveTruck} className="space-y-12">
              {activeTab === 'identity' && (
                <section className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center gap-4 mb-2">
                      <div className="w-1.5 h-6 bg-[#4361EE] rounded-full"></div>
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Base Identity</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Plate Number</label>
                      <input name="plate" defaultValue={editingTruck?.plate || ''} required className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="NGS-7788" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vehicle Type</label>
                      <input name="vehicle_type" defaultValue={editingTruck?.vehicle_type || ''} required className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="6 WHEELER" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Operational Status</label>
                        <select name="status" defaultValue={editingTruck?.status || 'active'} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-[#4361EE]/5 transition-all">
                          <option value="active">Active / Mission Ready</option>
                          <option value="in_repair">In Repair / Off-Duty</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reg. Expiry Date</label>
                        <input name="reg_expiry" type="date" defaultValue={editingTruck?.reg_expiry || ''} required className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white transition-all" />
                      </div>
                  </div>
                </section>
              )}

              {activeTab === 'maintenance' && (
                <section className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-amber-400 rounded-full"></div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Maintenance Ledger (PMS)</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Health %</label>
                        <input name="health" type="number" min="0" max="100" defaultValue={editingTruck?.health || 100} required className="w-24 bg-slate-50 rounded-2xl px-6 py-3 text-center text-sm font-black outline-none border border-slate-100" />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Last PMS Date</label>
                        <input name="last_pms_date" type="date" defaultValue={editingTruck?.last_pms_date || ''} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Last PMS Odometer (KM)</label>
                        <input name="last_pms_mileage" type="number" defaultValue={editingTruck?.last_pms_mileage || 0} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white transition-all" placeholder="45000" />
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#4361EE] uppercase tracking-widest px-1">Next Target PMS Date</label>
                        <input name="next_pms_date" type="date" defaultValue={editingTruck?.next_pms_date || ''} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#4361EE] uppercase tracking-widest px-1">Next Odometer Goal (KM)</label>
                        <input name="next_pms_mileage" type="number" defaultValue={editingTruck?.next_pms_mileage || 0} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="50000" />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'remarks' && (
                <section className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Repair Log & Remarks</h4>
                      </div>
                      <button type="button" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#4361EE] hover:bg-slate-100 transition-colors shadow-sm" title="Add New Log">
                        <span className="text-xl font-bold">+</span>
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Parts Repaired</label>
                      <textarea 
                        name="parts_repaired" 
                        defaultValue={editingTruck?.parts_repaired || ''} 
                        rows={3}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-[#4361EE]/5 transition-all resize-none" 
                        placeholder="List of components replaced or serviced..."
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date Repaired</label>
                      <input 
                        name="date_repaired" 
                        type="date" 
                        defaultValue={editingTruck?.date_repaired || ''} 
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white transition-all" 
                      />
                    </div>
                  </div>
                </section>
              )}

              <div className="pt-10 flex items-center justify-center gap-12">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingTruck(null); }} className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 tracking-widest transition-all">Abort</button>
                <button type="submit" disabled={loading} className="bg-[#4361EE] text-white px-16 py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl disabled:opacity-50">Synchronize Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FuelMonitor: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogFuel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      time: fd.get('refuelDate') as string,
      truck: fd.get('truck') as string,
      liters: parseFloat(fd.get('liters') as string) || 0,
      startingOdo: parseInt(fd.get('startingOdo') as string) || 0,
      kpl: 0,
      status: 'Awaiting Audit'
    };
    state.setFuelEvents([newEvent, ...state.fuelEvents]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Efficiency Monitor</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Fuel volumetric and economy tracking.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2">
          <span className="text-lg font-bold">+</span> Log Fuel Event
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-50">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50">
              <th className="pb-8">Asset ID</th>
              <th className="pb-8">Volumetric Data</th>
              <th className="pb-8">Starting Odo</th>
              <th className="pb-8">Status</th>
              <th className="pb-8 text-right">Audit Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {state.fuelEvents.map((i: any) => (
              <tr key={i.id} className="hover:bg-slate-50 transition-all">
                <td className="py-6 font-black text-slate-900">{i.truck}</td>
                <td className="py-6 text-sm font-black text-[#4361EE]">{i.liters} L</td>
                <td className="py-6 text-sm font-black text-slate-600">{i.startingOdo?.toLocaleString() || '--'} KM</td>
                <td className="py-6"><span className="text-[9px] font-black uppercase px-3 py-1 bg-slate-100 rounded-full">{i.status}</span></td>
                <td className="py-6 text-[10px] font-bold text-slate-400 uppercase text-right">{i.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 animate-in zoom-in-95 duration-300 relative">
            <h3 className="text-2xl font-black text-[#1e293b] tracking-tighter uppercase mb-12 text-center">NEW FUEL EVENT</h3>
            <form onSubmit={handleLogFuel} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">SELECT ASSET</label>
                <select name="truck" required className="w-full bg-[#f8fafc] border border-transparent focus:border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none transition-all appearance-none">
                  {state.trucks.map((t: TruckAsset) => <option key={t.id} value={t.plate}>{t.plate}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">STARTING ODO</label>
                  <input name="startingOdo" type="number" required className="w-full bg-[#f8fafc] border border-transparent focus:border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none transition-all" placeholder="0" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">LITERS FILLED</label>
                  <input name="liters" type="number" step="0.01" required className="w-full bg-[#f8fafc] border border-transparent focus:border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none transition-all" placeholder="0.00" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">DATE GAS REFILLED</label>
                <input name="refuelDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-[#f8fafc] border border-transparent focus:border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none transition-all" />
              </div>

              <div className="pt-10 flex flex-col items-center gap-6">
                <button type="submit" className="w-full bg-[#4361EE] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 active:scale-95 transition-all">CONFIRM EVENT</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors">ABORT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CRM: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newContact = {
      id: Math.random().toString(36).substr(2, 9),
      name: fd.get('name') as string,
      company: fd.get('company') as string,
      phone: fd.get('phone') as string,
      tags: [fd.get('tag') as string]
    };
    state.setCrmContacts([newContact, ...state.crmContacts]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Network Contacts</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Global stakeholder and vendor directory.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2">
          <span className="text-lg font-bold">+</span> Add Contact
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {state.crmContacts.map((c: any) => (
          <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">👤</div>
            <h4 className="text-xl font-black text-slate-900 tracking-tight mb-1">{c.name}</h4>
            <p className="text-[10px] font-bold text-[#4361EE] uppercase tracking-[0.2em] mb-6">{c.company}</p>
            <div className="flex justify-between items-center pt-6 border-t border-slate-50">
              <span className="text-[11px] font-black text-slate-400">{c.phone}</span>
              <div className="flex gap-1">
                {c.tags?.map((tag: string) => <span key={tag} className="text-[8px] font-black uppercase px-2 py-1 bg-slate-50 rounded-md text-slate-500">{tag}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-8 text-center">New Contact</h3>
            <form onSubmit={handleAddContact} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Stakeholder Name</label>
                <input name="name" required className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Organization</label>
                  <input name="company" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Company Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tag</label>
                  <select name="tag" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                    <option value="Vendor">Vendor</option>
                    <option value="Client">Client</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Contact Number</label>
                <input name="phone" required className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="09xx-xxx-xxxx" />
              </div>
              <div className="pt-8 flex justify-center gap-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-xs font-black uppercase text-slate-400">Abort</button>
                <button type="submit" className="bg-[#4361EE] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl">Confirm Identity</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Settings: React.FC<{ state: any; currentUser: ManagedUser }> = ({ state, currentUser }) => {
  const handleUpdateUser = (userId: string, updates: Partial<ManagedUser>) => {
    state.setUsers((prev: ManagedUser[]) => 
      prev.map((u: ManagedUser) => u.id === userId ? { ...u, ...updates } : u)
    );
  };

  const handleUpdateAccess = (userId: string, key: keyof UserAccess, val: boolean) => {
    state.setUsers((prev: ManagedUser[]) => 
      prev.map((u: ManagedUser) => {
        if (u.id === userId) {
          return { ...u, access: { ...u.access, [key]: val } };
        }
        return u;
      })
    );
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser.id) {
      alert("Security Protocol: You cannot delete your own administrative account while session is active.");
      return;
    }
    if (confirm("System Alert: Permanently revoke all access for this team member? This action is immediate and cannot be rolled back.")) {
      state.setUsers((prev: ManagedUser[]) => prev.filter(u => u.id !== userId));
    }
  };

  const handleAddUser = () => {
    const newUser: ManagedUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: 'user' + (state.users.length + 1),
      fullName: 'New Team Member',
      role: UserRole.STAFF,
      password: '1234',
      access: { dashboard: true, receipts: true, team: false, trucks: false, fuel: true, crm: false, dispatching: true }
    };
    state.setUsers([...state.users, newUser]);
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="mb-10">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Controls</h2>
        <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Global configurations and security audit.</p>
      </div>

      {currentUser.role === UserRole.ADMIN && (
        <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-50">
          <div className="flex items-center justify-between mb-10 px-4">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-[#4361EE] rounded-full"></div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Teams & User Management</h3>
            </div>
            <button 
              onClick={handleAddUser}
              className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4361EE] hover:bg-slate-100 transition-all shadow-sm border border-slate-100"
              title="Add Team Member"
            >
              <span className="text-2xl font-bold">+</span>
            </button>
          </div>

          <div className="space-y-10">
            {state.users.map((u: ManagedUser) => (
              <div key={u.id} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 flex flex-col gap-8 transition-all hover:bg-white hover:shadow-xl group">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#4361EE] text-white flex items-center justify-center rounded-2xl font-black text-lg">
                      {u.fullName.charAt(0)}
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <input 
                          className="text-lg font-black text-slate-900 bg-transparent border-none outline-none focus:ring-0 w-full lg:w-64 pr-8" 
                          value={u.fullName} 
                          onChange={(e) => handleUpdateUser(u.id, { fullName: e.target.value })} 
                        />
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="Revoke Access"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-[#4361EE] uppercase tracking-widest">{u.role === UserRole.ADMIN ? 'Admin' : 'Operations Staff'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 max-w-xl">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">ID (Username)</label>
                      <input 
                        className="w-full bg-white rounded-xl px-5 py-3 text-xs font-black outline-none border border-slate-100" 
                        value={u.username} 
                        onChange={(e) => handleUpdateUser(u.id, { username: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Access Key (Password)</label>
                      <input 
                        type="password"
                        className="w-full bg-white rounded-xl px-5 py-3 text-xs font-black outline-none border border-slate-100" 
                        value={u.password || ''} 
                        onChange={(e) => handleUpdateUser(u.id, { password: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Functional Access Mapping</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.keys(u.access).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleUpdateAccess(u.id, key as keyof UserAccess, !(u.access as any)[key])}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                          (u.access as any)[key] 
                            ? 'bg-[#4361EE] border-[#4361EE] text-white shadow-md' 
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// --- Auth Shim ---
const Login: React.FC<{ state: any; onLogin: (u: ManagedUser) => void }> = ({ state, onLogin }) => {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 text-center border border-slate-100">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Shekinah</h1>
        <p className="text-slate-400 mt-2 font-bold uppercase tracking-[0.3em] text-[10px] mb-12">Logistics Ecosystem</p>
        <form onSubmit={e => { e.preventDefault(); const user = state.users.find((x:any)=>x.username===u && x.password===p); if(user) onLogin(user); else setErr('Validation Error.'); }} className="space-y-6">
          {err && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-[1.5rem] border border-red-100">{err}</div>}
          <input value={u} onChange={e => setU(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#4361EE] rounded-[1.5rem] px-8 py-5 outline-none text-sm font-black transition-all" placeholder="IDENTITY ID" />
          <input value={p} type="password" onChange={e => setP(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-[#4361EE] rounded-[1.5rem] px-8 py-5 outline-none text-sm font-black transition-all" placeholder="ACCESS KEY" />
          <button type="submit" className="w-full bg-[#4361EE] text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase text-xs tracking-[0.2em] active:scale-95 transition-all">Verify Identity</button>
        </form>
      </div>
    </div>
  );
};

// --- Main App Entry ---
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<ManagedUser | null>(null);
  const state = useAppState();

  if (!currentUser) return <Login state={state} onLogin={setCurrentUser} />;

  return (
    <Router>
      <div className="min-h-screen bg-[#F1F5F9]">
        <Sidebar user={currentUser} onLogout={() => setCurrentUser(null)} />
        <TopBar />
        {/* Removed UserFloatingProfile component from here as it's now integrated in Sidebar */}
        <ChatBot />
        <main className="transition-all duration-300 pb-12">
          <Routes>
            <Route path="/" element={currentUser.access.dashboard ? <Dashboard state={state} /> : <Navigate to="/settings" />} />
            <Route path="/dispatching" element={currentUser.access.dispatching ? <Dispatching state={state} /> : <Navigate to="/settings" />} />
            <Route path="/receipts" element={currentUser.access.receipts ? <Receipts state={state} user={currentUser} /> : <Navigate to="/settings" />} />
            <Route path="/team" element={currentUser.access.team ? <Team state={state} /> : <Navigate to="/settings" />} />
            <Route path="/trucks" element={currentUser.access.trucks ? <Trucks state={state} /> : <Navigate to="/settings" />} />
            <Route path="/fuel" element={currentUser.access.fuel ? <FuelMonitor state={state} /> : <Navigate to="/settings" />} />
            <Route path="/crm" element={currentUser.access.crm ? <CRM state={state} /> : <Navigate to="/settings" />} />
            <Route path="/settings" element={<Settings state={state} currentUser={currentUser} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
