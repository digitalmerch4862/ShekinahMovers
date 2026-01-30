/// <reference lib="dom" />
/// <reference lib="esnext" />

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole, AuditLog, ExpenseCategory, ReceiptStatus, ReceiptData, Employee, TruckAsset, RepairLog } from './types';
import { HOLIDAYS } from './constants';
import { extractReceiptData } from './lib/gemini';

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
      created_at: new Date().toISOString(),
      repairLogs: []
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
      created_at: new Date().toISOString(),
      repairLogs: []
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
    { role: 'ai', text: "Hello! I'm your Shekinah Operations Specialist. Need help navigating the fleet manager, receipt scanning, or dispatching?" }
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

    // AI library removed, returning static response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: "I am currently in maintenance mode as my neural network features are disabled." }]);
      setIsTyping(false);
    }, 1000);
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
            <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">Operations Assistant</p>
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
                placeholder="Ask me anything..." 
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
  const location = useLocation();

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

  const getPageHeader = () => {
    switch(location.pathname) {
        case '/': return { title: 'Fleet Overview', subtitle: 'Real-time performance metrics.' };
        case '/dispatching': return { title: 'Dispatch Schedule', subtitle: 'Fleet deployment and task orchestration.' };
        case '/receipts': return { title: 'Receipt Intelligence', subtitle: 'Autonomous document parsing and audit readiness.' };
        case '/team': return { title: 'Personnel Roster', subtitle: 'Driver and operations staff management with compliance monitoring.' };
        case '/trucks': return { title: 'Fleet Asset Manager', subtitle: 'Real-time mechanical health & compliance tracking.' };
        case '/fuel': return { title: 'Efficiency Monitor', subtitle: 'Fuel volumetric and economy tracking.' };
        case '/crm': return { title: 'Network Contacts', subtitle: 'Global stakeholder and vendor directory.' };
        case '/settings': return { title: 'System Controls', subtitle: 'Global configurations and security audit.' };
        default: return { title: 'Shekinah Movers', subtitle: 'Management Console' };
    }
  };

  const { title, subtitle } = getPageHeader();

  return (
    <header 
      className={`fixed top-4 left-[18rem] right-4 h-24 z-50 flex items-center justify-between px-10 rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'
      }`}
    >
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h2>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
      </div>
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
      <div className="flex justify-end mb-10">
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
      <div className="mb-10 flex justify-end gap-6">
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

const Trucks: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'maintenance' | 'remarks'>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairLogs, setRepairLogs] = useState<RepairLog[]>([]);

  useEffect(() => {
    if (isModalOpen) {
        if (editingTruck) {
            if (editingTruck.repairLogs && editingTruck.repairLogs.length > 0) {
                setRepairLogs(editingTruck.repairLogs);
            } else if (editingTruck.parts_repaired || editingTruck.date_repaired) {
                // Backward compatibility
                setRepairLogs([{
                    id: Math.random().toString(36).substr(2, 9),
                    parts: editingTruck.parts_repaired || '',
                    date: editingTruck.date_repaired || ''
                }]);
            } else {
                setRepairLogs([{ id: Math.random().toString(36).substr(2, 9), parts: '', date: '' }]);
            }
        } else {
            setRepairLogs([{ id: Math.random().toString(36).substr(2, 9), parts: '', date: '' }]);
        }
    }
  }, [isModalOpen, editingTruck]);

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
        repairLogs: repairLogs,
        parts_repaired: repairLogs.length > 0 ? repairLogs[0].parts : '',
        date_repaired: repairLogs.length > 0 ? repairLogs[0].date : ''
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
      <div className="flex justify-end mb-10">
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
               <button type="button" onClick={() => setActiveTab('identity')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'identity' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Base Identity</button>
               <button type="button" onClick={() => setActiveTab('maintenance')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'maintenance' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Maintenance (PMS)</button>
               <button type="button" onClick={() => setActiveTab('remarks')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'remarks' ? 'bg-white text-[#4361EE] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Remarks</button>
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
                <section className="space-y-6 animate-in fade-in duration-500 h-96 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-2 border-b border-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Repair Log & Remarks</h4>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setRepairLogs([...repairLogs, { id: Math.random().toString(36).substr(2, 9), parts: '', date: '' }])}
                        className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#4361EE] hover:bg-slate-100 transition-colors shadow-sm" 
                        title="Add New Log"
                      >
                        <span className="text-xl font-bold">+</span>
                      </button>
                  </div>

                  <div className="space-y-6">
                    {repairLogs.map((log, index) => (
                      <div key={log.id} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start group relative p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                         {repairLogs.length > 1 && (
                           <button 
                              type="button"
                              onClick={() => setRepairLogs(repairLogs.filter(l => l.id !== log.id))}
                              className="absolute -right-2 -top-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                           >✕</button>
                         )}
                         
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                              {index === 0 ? 'Parts Repaired' : `Log #${index + 1} Parts`}
                            </label>
                            <textarea 
                              value={log.parts}
                              onChange={(e) => {
                                  const newLogs = [...repairLogs];
                                  newLogs[index].parts = e.target.value;
                                  setRepairLogs(newLogs);
                              }}
                              rows={2}
                              className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-[#4361EE]/5 transition-all resize-none" 
                              placeholder="List of components replaced or serviced..."
                            />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                              {index === 0 ? 'Date Repaired' : 'Date'}
                            </label>
                            <input 
                              type="date" 
                              value={log.date}
                              onChange={(e) => {
                                  const newLogs = [...repairLogs];
                                  newLogs[index].date = e.target.value;
                                  setRepairLogs(newLogs);
                              }}
                              className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:bg-white transition-all" 
                            />
                         </div>
                      </div>
                    ))}
                    {repairLogs.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">No repair logs yet. Click + to add.</div>
                    )}
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
  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
           <h3 className="text-xl font-black text-slate-900 mb-6">Fuel Efficiency</h3>
           <div className="h-64 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
             Chart Visualization
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
           <h3 className="text-xl font-black text-slate-900 mb-6">Recent Logs</h3>
           <div className="space-y-4">
             {state.fuelEvents.map((ev: any) => (
                <div key={ev.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                   <div>
                      <p className="text-sm font-black text-slate-900">{ev.truck}</p>
                      <p className="text-xs text-slate-500">{ev.time}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-[#4361EE]">{ev.liters} L</p>
                      <p className="text-xs text-slate-500">{ev.startingOdo} km</p>
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

const Receipts: React.FC<{ state: any }> = ({ state }) => {
  const [processing, setProcessing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const processReceiptImage = async (base64Data: string, mimeType: string) => {
    setProcessing(true);
    setIsCameraOpen(false);
    setShowMenu(false);
    try {
      const data = await extractReceiptData(base64Data, mimeType);
      
      const newReceipt = {
        id: Math.random().toString(36).substr(2, 9),
        receiptNo: data.invoice_or_receipt_no || 'Pending',
        vendor: data.vendor_name || 'Unknown Vendor',
        date: data.receipt_date || new Date().toISOString().split('T')[0],
        driver: 'System Upload',
        category: data.suggested_category || 'other',
        amount: data.total || 0,
        status: 'needs_review',
        tin: data.vendor_tin,
        documentType: data.document_type
      };
      
      state.setReceipts((prev: any) => [newReceipt, ...prev]);
    } catch (err) {
      console.error(err);
      alert("Failed to parse receipt. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const base64Url = await fileToBase64(file);
        const base64Data = base64Url.split(',')[1];
        processReceiptImage(base64Data, file.type);
    } catch (e) {
        alert("File error");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setShowMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // Small delay to ensure ref is mounted
      setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch (err) {
      console.error(err);
      alert("Unable to access camera. Please ensure permissions are granted.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const url = canvas.toDataURL('image/jpeg');
      const base64 = url.split(',')[1];
      stopCamera();
      processReceiptImage(base64, 'image/jpeg');
    }
  };

  const handlePaste = async () => {
     // Try async clipboard API first
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // Look for image types
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          const reader = new FileReader();
          reader.onload = () => {
             const base64Url = reader.result as string;
             const base64 = base64Url.split(',')[1];
             processReceiptImage(base64, blob.type);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      // If we reach here, no image found via API
      alert("No image found in clipboard. Try pressing Ctrl+V if you have an image copied.");
    } catch (err) {
      // Fallback
       alert("Clipboard access not available. Please press Ctrl+V to paste.");
    }
  };
  
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
       const items = e.clipboardData?.items;
       if (!items) return;
       for (let i = 0; i < items.length; i++) {
         if (items[i].type.indexOf('image') !== -1) {
           const blob = items[i].getAsFile();
           if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                 const base64Url = reader.result as string;
                 const base64 = base64Url.split(',')[1];
                 processReceiptImage(base64, blob.type);
              };
              reader.readAsDataURL(blob);
           }
         }
       }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700 relative">
      <div className="flex justify-between items-center mb-10">
         <div className="flex gap-4">
            <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-50">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Spend</span>
               <span className="text-xl font-black text-slate-900">₱{state.receipts.reduce((acc: number, r: any) => acc + r.amount, 0).toLocaleString()}</span>
            </div>
         </div>
         <div className="flex gap-4 relative" ref={menuRef}>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
            />
            
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              disabled={processing}
              className="bg-[#4361EE] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3"
            >
              {processing ? 'Analyzing...' : <><span>📷</span> Scan Receipt</>}
            </button>

            {showMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                 <div className="p-2 space-y-1">
                    <button onClick={startCamera} className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl text-xs font-black text-slate-600 flex items-center gap-3">
                       <span>📸</span> Use Camera
                    </button>
                    <button onClick={handlePaste} className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl text-xs font-black text-slate-600 flex items-center gap-3">
                       <span>📋</span> Paste Screenshot
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl text-xs font-black text-slate-600 flex items-center gap-3">
                       <span>📂</span> Browse Files
                    </button>
                 </div>
              </div>
            )}
         </div>
      </div>

      {isCameraOpen && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center">
           <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
           <div className="absolute bottom-10 flex gap-6">
              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-[#4361EE] shadow-2xl flex items-center justify-center text-3xl">📸</button>
              <button onClick={stopCamera} className="w-20 h-20 bg-red-500 rounded-full text-white font-black shadow-2xl flex items-center justify-center">✕</button>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {state.receipts.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-6 text-sm font-bold text-slate-600">{r.date}</td>
                <td className="p-6">
                  <div className="font-black text-slate-900">{r.vendor}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">{r.receiptNo}</div>
                </td>
                <td className="p-6">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {r.category}
                  </span>
                </td>
                <td className="p-6 text-right font-black text-slate-900">₱{r.amount.toLocaleString()}</td>
                <td className="p-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    r.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    r.status === 'needs_review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Team: React.FC<{ state: any }> = ({ state }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newMember: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      fullName: fd.get('fullName') as string,
      role: fd.get('role') as any,
      dayOff: fd.get('dayOff') as any,
      phone: fd.get('phone') as string,
      licenseNumber: fd.get('licenseNumber') as string,
      licenseType: fd.get('licenseType') as any,
      licenseExpiration: fd.get('licenseExpiration') as string,
    };
    state.setTeam((prev: Employee[]) => [...prev, newMember]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
       <div className="flex justify-end mb-10">
        <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-[#4361EE] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
            <span className="text-xl font-bold">+</span> New Employee
        </button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.team.map((member: any) => (
             <div key={member.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">
                   {member.role === 'Driver' ? '🚛' : '👷'}
                </div>
                <div>
                   <h3 className="text-lg font-black text-slate-900">{member.fullName}</h3>
                   <p className="text-[10px] font-bold text-[#4361EE] uppercase tracking-[0.2em]">{member.role}</p>
                   {member.phone && <p className="text-xs text-slate-400 mt-1">{member.phone}</p>}
                </div>
             </div>
          ))}
       </div>

       {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-10 text-center">
              New Personnel
            </h3>
            <form onSubmit={handleSaveMember} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Full Name</label>
                <input name="fullName" required className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="Juan Dela Cruz" />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Role</label>
                    <select name="role" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                       <option value="Driver">Driver</option>
                       <option value="Helper">Helper</option>
                       <option value="Staff">Staff</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Rest Day</label>
                    <select name="dayOff" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none">
                       {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Weekends'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                <input name="phone" required className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/5 transition-all" placeholder="09xx-xxx-xxxx" />
              </div>

               <div className="pt-4 border-t border-slate-50 mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Driver License Details (Optional)</p>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">License No.</label>
                        <input name="licenseNumber" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Expiry</label>
                        <input name="licenseExpiration" type="date" className="w-full bg-slate-50 rounded-2xl px-8 py-5 text-sm font-black outline-none" />
                     </div>
                  </div>
               </div>

              <div className="pt-8 flex justify-center gap-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">Abort</button>
                <button type="submit" className="bg-[#4361EE] text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30">
                  Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CRM: React.FC<{ state: any }> = ({ state }) => {
  return (
    <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
       <div className="space-y-4">
          {state.crmContacts.map((c: any) => (
             <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex justify-between items-center">
                <div>
                   <h3 className="font-black text-slate-900">{c.name}</h3>
                   <p className="text-xs text-slate-500">{c.company}</p>
                </div>
                <div className="text-right">
                   <p className="text-sm font-bold text-[#4361EE]">{c.phone}</p>
                   <div className="flex gap-2 justify-end mt-1">
                      {c.tags.map((t: string) => (
                         <span key={t} className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">{t}</span>
                      ))}
                   </div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

const Settings: React.FC<{ state: any }> = ({ state }) => (
  <div className="p-8 mt-32 ml-72 animate-in fade-in duration-700">
     <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-50 text-center">
        <p className="text-slate-400 font-black text-sm uppercase tracking-widest">System Configurations Unavailable</p>
     </div>
  </div>
);

const Login: React.FC<{ onLogin: (u: ManagedUser) => void; users: ManagedUser[] }> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl">
        <h1 className="text-3xl font-black text-slate-900 text-center mb-2 uppercase tracking-tight">Shekinah</h1>
        <p className="text-center text-[10px] font-bold text-[#4361EE] uppercase tracking-[0.3em] mb-10">Management Console</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Operator ID</label>
            <input 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-50 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/10 transition-all"
              placeholder="Username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Access Key</label>
            <input 
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-[#4361EE]/10 transition-all"
              placeholder="Password"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          <button type="submit" className="w-full bg-[#4361EE] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const state = useAppState();
  const [user, setUser] = useState<ManagedUser | null>(null);

  if (!user) {
    return <Login onLogin={setUser} users={state.users} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-600 selection:bg-[#4361EE] selection:text-white">
        <Sidebar user={user} onLogout={() => setUser(null)} />
        <TopBar />
        <Routes>
          <Route path="/" element={<Dashboard state={state} />} />
          <Route path="/dispatching" element={<Dispatching state={state} />} />
          <Route path="/trucks" element={<Trucks state={state} />} />
          <Route path="/fuel" element={<FuelMonitor state={state} />} />
          <Route path="/receipts" element={<Receipts state={state} />} />
          <Route path="/team" element={<Team state={state} />} />
          <Route path="/crm" element={<CRM state={state} />} />
          <Route path="/settings" element={<Settings state={state} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatBot />
      </div>
    </Router>
  );
};

export default App;