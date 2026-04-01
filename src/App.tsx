import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import jsPDF from "jspdf";
import QRCode from "qrcode";

type NavSection = "Dashboard" | "Clients" | "Orders" | "Billing" | "Albums" | "Photo Selection" | "Calendar" | "WhatsApp" | "CamShot AI" | "Settings";
type OrderStatus = "Pending" | "Confirmed" | "Completed";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  eventType: string;
  totalSpent: number;
  createdAt: string;
};

type Order = {
  id: string;
  clientId: string;
  title: string;
  date: string;
  venue: string;
  amount: number;
  paid: number;
  status: OrderStatus;
};

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
};

type Album = {
  id: string;
  clientId: string;
  name: string;
  totalPhotos: number;
  selectedPhotos: number;
  delivered: boolean;
};

type WhatsAppLog = {
  id: string;
  target: string;
  message: string;
  sentAt: string;
};
type CamshotLead = {
  id: string;
  eventName: string;
  guestName: string;
  phone: string;
  selectedPhotos: string[];
  pricePerPhoto: number;
  paid: number;
  delivered: boolean;
  faceScore: number;
  createdAt: string;
};
type Settings = {
  studioName: string;
  tagline: string;
  whatsappNumber: string;
  upiId: string;
  gstin: string;
  address: string;
};

const initialClients: Client[] = [
  {
    id: "c1",
    name: "Aarav & Diya",
    phone: "919811112233",
    email: "aaravdiya@gmail.com",
    eventType: "Wedding",
    totalSpent: 90000,
    createdAt: "2025-03-10",
  },
  {
    id: "c2",
    name: "Karan Mehta",
    phone: "919844556677",
    email: "karan.m@gmail.com",
    eventType: "Pre-Wedding",
    totalSpent: 28000,
    createdAt: "2025-03-20",
  },
];

const initialOrders: Order[] = [
  {
    id: "o1",
    clientId: "c1",
    title: "Wedding Main Day",
    date: "2025-04-11",
    venue: "Royal Palace, Jaipur",
    amount: 90000,
    paid: 45000,
    status: "Confirmed",
  },
  {
    id: "o2",
    clientId: "c2",
    title: "Pre-Wedding Shoot",
    date: "2025-04-21",
    venue: "Amber Fort",
    amount: 28000,
    paid: 28000,
    status: "Completed",
  },
];

const initialAlbums: Album[] = [
  { id: "a1", clientId: "c1", name: "Aarav Wedding Album", totalPhotos: 320, selectedPhotos: 95, delivered: false },
  { id: "a2", clientId: "c2", name: "Karan Pre-Wedding", totalPhotos: 180, selectedPhotos: 180, delivered: true },
];

const initialExpenses: Expense[] = [
  { id: "e1", title: "Assistant Photographer", category: "Team", amount: 12000, date: "2025-04-10" },
  { id: "e2", title: "Travel & Fuel", category: "Transport", amount: 4000, date: "2025-04-11" },
];

const initialSettings: Settings = {
  studioName: "s.h_photography11",
  tagline: "Wedding & Events",
  whatsappNumber: "919999999999",
  upiId: "studio@upi",
  gstin: "",
  address: "Jaipur, Rajasthan",
};

const tabs: NavSection[] = ["Dashboard", "Clients", "Orders", "Billing", "Albums", "Photo Selection", "Calendar", "WhatsApp", "CamShot AI", "Settings"];

const makeId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

const money = (amount: number) => `INR ${amount.toLocaleString("en-IN")}`;

export default function App() {
  const [active, setActive] = useState<NavSection>("Dashboard");
  const [clients, setClients] = useLocalStorageState<Client[]>("sh_clients", initialClients);

  const [camshotLeads, setCamshotLeads] = useLocalStorageState<CamshotLead[]>(
    "sh_camshot_leads",
    []
  );

  const [camshotForm, setCamshotForm] = useState({
    eventName: "",
    guestName: "",
    phone: "",
  });

  const [scanScore, setScanScore] = useState<number | null>(null);
  const [activeLeadId, setActiveLeadId] = useState("");
  const [upiQr, setUpiQr] = useState("");
  const [paymentInput, setPaymentInput] = useState<Record<string, string>>({});

  const [orders, setOrders] = useLocalStorageState<Order[]>("sh_orders", initialOrders);
  const [albums, setAlbums] = useLocalStorageState<Album[]>("sh_albums", initialAlbums);
  const [expenses, setExpenses] = useLocalStorageState<Expense[]>("sh_expenses", initialExpenses);
  const [whatsLogs, setWhatsLogs] = useLocalStorageState<WhatsAppLog[]>("sh_whatsapp_logs", []);
  const [settings, setSettings] = useLocalStorageState<Settings>("sh_settings", initialSettings);
  const [selectionAlbumId, setSelectionAlbumId] = useState<string>(albums[0]?.id ?? "");
  const [selectedPhotos, setSelectedPhotos] = useLocalStorageState<string[]>("sh_selected_photos", []);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [invoiceOrderId, setInvoiceOrderId] = useState<string>(orders[0]?.id ?? "");

  const revenue = useMemo(() => orders.reduce((sum, order) => sum + order.amount, 0), [orders]);
  const collected = useMemo(() => orders.reduce((sum, order) => sum + order.paid, 0), [orders]);
  const outstanding = revenue - collected;
  const nextShoots = useMemo(() => orders.filter((order) => order.status !== "Completed").slice(0, 4), [orders]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client])), [clients]);

  useEffect(() => {
    const selectedOrder = orders.find((order) => order.id === invoiceOrderId);
    if (!selectedOrder) return;
    const note = `Invoice ${selectedOrder.title}`;
    const upi = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.studioName)}&am=${selectedOrder.amount - selectedOrder.paid}&cu=INR&tn=${encodeURIComponent(note)}`;
    QRCode.toDataURL(upi, { width: 260, margin: 1, color: { dark: "#d4af37", light: "#08070b" } }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [invoiceOrderId, orders, settings.upiId, settings.studioName]);

  const sendWhatsApp = (phone: string, message: string) => {
    const target = phone || settings.whatsappNumber;
    if (!target) return;
    setWhatsLogs((prev) => [{ id: makeId(), target, message, sentAt: new Date().toISOString() }, ...prev].slice(0, 20));
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const exportInvoicePdf = (order: Order) => {
    const client = clientMap[order.clientId];
    const balance = Math.max(order.amount - order.paid, 0);
    const doc = new jsPDF();
    doc.setFillColor(16, 12, 24);
    doc.rect(0, 0, 210, 36, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(22);
    doc.text(settings.studioName, 14, 18);
    doc.setFontSize(11);
    doc.text(settings.tagline, 14, 27);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.text(`Client: ${client?.name ?? "-"}`, 14, 50);
    doc.text(`Phone: ${client?.phone ?? "-"}`, 14, 58);
    doc.text(`Shoot: ${order.title}`, 14, 66);
    doc.text(`Date: ${order.date}`, 14, 74);
    doc.text(`Venue: ${order.venue}`, 14, 82);
    doc.line(14, 90, 196, 90);
    doc.text(`Package Total: ${money(order.amount)}`, 14, 102);
    doc.text(`Amount Paid: ${money(order.paid)}`, 14, 110);
    doc.text(`Balance Due: ${money(balance)}`, 14, 118);
    doc.text(`UPI: ${settings.upiId}`, 14, 132);
    if (settings.gstin) doc.text(`GSTIN: ${settings.gstin}`, 14, 140);
    doc.setFontSize(10);
    doc.text(settings.address, 14, 150);
    doc.save(`${settings.studioName}-${order.title.replace(/\s+/g, "-")}.pdf`);
  };

  const monthDays = useMemo(() => {
    const year = 2025;
    const month = 3;
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    return { first, total };
  }, []);

  const photoTiles = useMemo(() => Array.from({ length: 18 }, (_, idx) => `p-${idx + 1}`), []);
  const selectedAlbum = albums.find((album) => album.id === selectionAlbumId);
const handleScanFace = () => {
  const score = Math.floor(72 + Math.random() * 27);
  setScanScore(score);
};

const handleAddCamshotRequest = () => {
  if (!camshotForm.eventName || !camshotForm.guestName || !camshotForm.phone) return;

  const lead: CamshotLead = {
    id: makeId(),
    eventName: camshotForm.eventName,
    guestName: camshotForm.guestName,
    phone: camshotForm.phone,
    selectedPhotos: [],
    pricePerPhoto: 20,
    paid: 0,
    delivered: false,
    faceScore: scanScore ?? 0,
    createdAt: new Date().toISOString(),
  };

  setCamshotLeads((prev) => [lead, ...prev]);
  setCamshotForm({ eventName: "", guestName: "", phone: "" });
  setScanScore(null);
};

const toggleCamshotPhoto = (leadId: string, photoId: string) => {
  setCamshotLeads((prev) =>
    prev.map((lead) =>
      lead.id !== leadId
        ? lead
        : {
            ...lead,
            selectedPhotos: lead.selectedPhotos.includes(photoId)
              ? lead.selectedPhotos.filter((p) => p !== photoId)
              : [...lead.selectedPhotos, photoId],
          }
    )
  );
};

const recordCamshotPayment = (leadId: string) => {
  const amount = Number(paymentInput[leadId] || 0);
  if (!amount || amount <= 0) return;

  setCamshotLeads((prev) =>
    prev.map((lead) =>
      lead.id === leadId ? { ...lead, paid: Math.max(0, lead.paid + amount) } : lead
    )
  );

  setPaymentInput((prev) => ({ ...prev, [leadId]: "" }));
};

const generateCamshotUpiQr = async (lead: CamshotLead) => {
  const total = lead.selectedPhotos.length * lead.pricePerPhoto;
  const due = Math.max(0, total - lead.paid);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(
    settings.studioName
  )}&am=${due}&cu=INR&tn=${encodeURIComponent(`CamShot ${lead.guestName}`)}`;

  const dataUrl = await QRCode.toDataURL(upiUrl);
  setActiveLeadId(lead.id);
  setUpiQr(dataUrl);
};

const sendCamshotWhatsapp = (lead: CamshotLead) => {
  const total = lead.selectedPhotos.length * lead.pricePerPhoto;
  const due = Math.max(0, total - lead.paid);

  const message = `Hi ${lead.guestName}, your CamShot photos are ready.
Selected: ${lead.selectedPhotos.length}
Total: INR ${total}
Paid: INR ${lead.paid}
Due: INR ${due}
UPI: ${settings.upiId}`;

  const phone = lead.phone.replace(/\D/g, "");
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer"
  );
};

const downloadCamshotPhotos = (lead: CamshotLead) => {
  const total = lead.selectedPhotos.length * lead.pricePerPhoto;
  const due = Math.max(0, total - lead.paid);
  if (due > 0) return;

  lead.selectedPhotos.forEach((photoId, idx) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <rect width="100%" height="100%" fill="black"/>
      <text x="50%" y="45%" fill="#facc15" font-size="42" text-anchor="middle">s.h_photography11</text>
      <text x="50%" y="55%" fill="#ffffff" font-size="30" text-anchor="middle">${lead.guestName} - Photo ${idx + 1}</text>
      <text x="50%" y="62%" fill="#facc15" font-size="22" text-anchor="middle">${photoId}</text>
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lead.guestName.replace(/\s+/g, "_")}_${idx + 1}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  });

  setCamshotLeads((prev) =>
    prev.map((x) => (x.id === lead.id ? { ...x, delivered: true } : x))
  );
};
  return (
    <div className="min-h-screen bg-[#07050b] text-[#f6e8ba]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-5 border-b border-[#3f3218] pb-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 rounded-full border border-[#7b642f] bg-[#140f1d]">
                <div className="absolute inset-2 rounded-full border-2 border-[#d4af37]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#c6a754]">S.H Photography 11</p>
                <h1 className="text-2xl font-semibold tracking-wide text-[#f8ebc8]">Studio CRM & Photo Selection Suite</h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-[#d9c58d]">Premium dashboard for client management, bookings, billing, albums, and final photo selection.</p>
          </div>
          <button
            onClick={() => setActive("Orders")}
            className="h-11 rounded-md border border-[#8f7233] bg-[#d4af37] px-5 text-sm font-semibold text-[#1a1308] transition hover:brightness-110"
          >
            New Booking
          </button>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-md border border-[#3f3218] bg-[#0e0a16] p-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  active === tab ? "bg-[#d4af37] font-semibold text-[#1c1508]" : "text-[#e2ce95] hover:bg-[#1a1326]"
                }`}
              >
                {tab}
              </button>
            ))}
          </aside>

          <main className="rounded-md border border-[#3f3218] bg-[#0c0814] p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {active === "Dashboard" && (
                  <section className="space-y-6">
                    <h2 className="text-xl font-semibold text-[#f9eecf]">Dashboard</h2>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {[{ label: "Revenue", value: money(revenue) }, { label: "Collected", value: money(collected) }, { label: "Outstanding", value: money(outstanding) }, { label: "Albums", value: String(albums.length) }].map((item) => (
                        <div key={item.label} className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                          <p className="text-xs uppercase tracking-wider text-[#b99a54]">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold text-[#f8e8bc]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#c8ab63]">Upcoming Shoots</h3>
                      <div className="space-y-3">
                        {nextShoots.map((shoot) => (
                          <div key={shoot.id} className="flex items-center justify-between border-b border-[#2d2310] pb-2 text-sm last:border-none">
                            <div>
                              <p className="font-medium text-[#f8eecf]">{shoot.title}</p>
                              <p className="text-[#d8c489]">{clientMap[shoot.clientId]?.name} • {shoot.date}</p>
                            </div>
                            <span className="rounded border border-[#6c5728] px-2 py-1 text-xs text-[#f6e1a2]">{shoot.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {active === "Clients" && (
                  <ClientsSection clients={clients} setClients={setClients} orders={orders} sendWhatsApp={sendWhatsApp} />
                )}

                {active === "Orders" && (
                  <OrdersSection
                    clients={clients}
                    orders={orders}
                    setOrders={setOrders}
                    sendWhatsApp={sendWhatsApp}
                    exportInvoicePdf={exportInvoicePdf}
                  />
                )}

                {active === "Billing" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">Billing</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Stat label="Collected" value={money(collected)} />
                      <Stat label="Outstanding" value={money(outstanding)} />
                      <Stat label="Expenses" value={money(expenses.reduce((sum, exp) => sum + exp.amount, 0))} />
                    </div>
                    <ExpenseForm setExpenses={setExpenses} />
                    <div className="space-y-2">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between rounded-md border border-[#4a3b1d] bg-[#130e1d] p-3 text-sm">
                          <p>{expense.title} <span className="text-[#af9150]">({expense.category})</span></p>
                          <p>{money(expense.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {active === "Albums" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">Albums</h2>
                    <AlbumForm clients={clients} setAlbums={setAlbums} />
                    <div className="space-y-3">
                      {albums.map((album) => {
                        const progress = Math.round((album.selectedPhotos / Math.max(album.totalPhotos, 1)) * 100);
                        return (
                          <div key={album.id} className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-medium">{album.name}</p>
                              <p className="text-sm text-[#d4be7a]">{clientMap[album.clientId]?.name}</p>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded bg-[#2d2315]">
                              <motion.div className="h-full bg-[#d4af37]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-[#d3c08b]">Selection progress: {album.selectedPhotos}/{album.totalPhotos} ({progress}%)</p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {active === "Photo Selection" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">Photo Selection</h2>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className="rounded border border-[#6f5727] bg-[#140f1d] px-3 py-2 text-sm"
                        value={selectionAlbumId}
                        onChange={(e) => setSelectionAlbumId(e.target.value)}
                      >
                        {albums.map((album) => (
                          <option key={album.id} value={album.id}>{album.name}</option>
                        ))}
                      </select>
                      <button
                        className="rounded border border-[#8d7234] bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#251a0a]"
                        onClick={() => {
                          if (!selectedAlbum) return;
                          setAlbums((prev) => prev.map((album) => (album.id === selectedAlbum.id ? { ...album, selectedPhotos: selectedPhotos.length } : album)));
                        }}
                      >
                        Confirm Selection ({selectedPhotos.length})
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {photoTiles.map((photo, index) => {
                        const checked = selectedPhotos.includes(photo);
                        return (
                          <button
                            key={photo}
                            onClick={() => setSelectedPhotos((prev) => (prev.includes(photo) ? prev.filter((p) => p !== photo) : [...prev, photo]))}
                            className={`h-28 rounded border text-left transition ${checked ? "border-[#d4af37] bg-[#2b1f09]" : "border-[#4a3b1d] bg-[#120d1b]"}`}
                          >
                            <div className="h-full bg-gradient-to-br from-[#2a1d0f] via-[#231825] to-[#1d1627] p-3">
                              <p className="text-xs uppercase tracking-widest text-[#d8bf79]">Frame {index + 1}</p>
                              <p className="mt-10 text-sm">{checked ? "Selected" : "Tap to Select"}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {active === "Calendar" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">Calendar - April 2025</h2>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-widest text-[#b99b58]">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <p key={day}>{day}</p>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: monthDays.first }).map((_, i) => <div key={`empty-${i}`} className="h-20 rounded border border-transparent" />)}
                      {Array.from({ length: monthDays.total }, (_, i) => i + 1).map((date) => {
                        const isoDate = `2025-04-${String(date).padStart(2, "0")}`;
                        const dayOrders = orders.filter((order) => order.date === isoDate);
                        return (
                          <div key={date} className="h-20 rounded border border-[#4a3b1d] bg-[#130e1d] p-2 text-left">
                            <p className="text-xs text-[#f2e2b5]">{date}</p>
                            {dayOrders[0] && <p className="mt-1 truncate text-[11px] text-[#d7c07f]">{dayOrders[0].title}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {active === "WhatsApp" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">WhatsApp Integration</h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                        <h3 className="mb-3 text-sm uppercase tracking-wider text-[#c8ab63]">Templates</h3>
                        <div className="space-y-2">
                          {[
                            "Your booking with s.h_photography11 is confirmed.",
                            "Friendly reminder: your pending payment is due today.",
                            "Your edited photos are ready for selection.",
                            "Please complete album selection to proceed with delivery.",
                            "Shoot reminder: we are excited to capture your event.",
                          ].map((template) => (
                            <button key={template} onClick={() => sendWhatsApp(settings.whatsappNumber, template)} className="w-full rounded border border-[#5b4923] px-3 py-2 text-left text-sm hover:bg-[#1b1429]">
                              {template}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            const due = orders.filter((order) => order.amount > order.paid);
                            due.forEach((order) => {
                              const client = clientMap[order.clientId];
                              if (client?.phone) sendWhatsApp(client.phone, `Hi ${client.name}, your outstanding amount is ${money(order.amount - order.paid)} for ${order.title}.`);
                            });
                          }}
                          className="mt-4 rounded bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#251a0a]"
                        >
                          Send Bulk Outstanding Reminders
                        </button>
                      </div>
                      <div className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                        <h3 className="mb-3 text-sm uppercase tracking-wider text-[#c8ab63]">Recent Activity</h3>
                        <div className="space-y-2">
                          {whatsLogs.slice(0, 8).map((log) => (
                            <div key={log.id} className="rounded border border-[#3d3016] bg-[#0f0a17] p-2 text-xs">
                              <p className="text-[#e9d9aa]">To: {log.target}</p>
                              <p className="truncate text-[#c8af69]">{log.message}</p>
                            </div>
                          ))}
                          {whatsLogs.length === 0 && <p className="text-sm text-[#d2bc82]">No messages sent yet.</p>}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
               {active === "CamShot AI" && (
  <section className="space-y-6">
    <h2 className="text-xl font-semibold text-amber-100">CamShot AI</h2>
    <p className="text-amber-100/80">
      Guest request, photo selection, INR 20/photo billing, UPI QR, WhatsApp delivery.
    </p>

    <div className="grid gap-3 md:grid-cols-4">
      <input
        className="rounded border border-amber-400/40 bg-black/30 px-3 py-2 text-amber-50 placeholder:text-amber-200/40"
        placeholder="Event Name"
        value={camshotForm.eventName}
        onChange={(e) => setCamshotForm((p) => ({ ...p, eventName: e.target.value }))}
      />
      <input
        className="rounded border border-amber-400/40 bg-black/30 px-3 py-2 text-amber-50 placeholder:text-amber-200/40"
        placeholder="Guest Name"
        value={camshotForm.guestName}
        onChange={(e) => setCamshotForm((p) => ({ ...p, guestName: e.target.value }))}
      />
      <input
        className="rounded border border-amber-400/40 bg-black/30 px-3 py-2 text-amber-50 placeholder:text-amber-200/40"
        placeholder="Phone Number"
        value={camshotForm.phone}
        onChange={(e) => setCamshotForm((p) => ({ ...p, phone: e.target.value }))}
      />
      <div className="flex gap-2">
        <button
          className="rounded border border-amber-400/50 px-3 py-2 text-amber-100"
          onClick={handleScanFace}
        >
          Scan Face + Match
        </button>
        <button
          className="rounded bg-amber-400 px-4 py-2 font-semibold text-black"
          onClick={handleAddCamshotRequest}
        >
          Add Request
        </button>
      </div>
    </div>

    {scanScore !== null && (
      <p className="text-sm text-amber-200">Match Score: {scanScore}%</p>
    )}

    <div className="space-y-4">
      {camshotLeads.map((lead) => {
        const total = lead.selectedPhotos.length * lead.pricePerPhoto;
        const due = Math.max(0, total - lead.paid);

        return (
          <div key={lead.id} className="rounded border border-amber-400/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-100">
                  {lead.guestName} - {lead.eventName}
                </p>
                <p className="text-sm text-amber-200/80">{lead.phone}</p>
              </div>
              <div className="text-sm text-amber-100">
                Score: {lead.faceScore}% | Delivered: {lead.delivered ? "Yes" : "No"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["P1", "P2", "P3", "P4", "P5"].map((pid) => {
                const selected = lead.selectedPhotos.includes(pid);
                return (
                  <button
                    key={pid}
                    onClick={() => toggleCamshotPhoto(lead.id, pid)}
                    className={`rounded px-3 py-1 text-sm ${
                      selected
                        ? "bg-amber-400 text-black"
                        : "border border-amber-400/50 text-amber-100"
                    }`}
                  >
                    {pid}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 md:grid-cols-4 text-sm">
              <p className="text-amber-100">Selected: {lead.selectedPhotos.length}</p>
              <p className="text-amber-100">Total: INR {total}</p>
              <p className="text-amber-100">Paid: INR {lead.paid}</p>
              <p className="text-amber-100">Due: INR {due}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                className="rounded border border-amber-400/40 bg-black/30 px-3 py-2 text-amber-50"
                placeholder="Add payment"
                value={paymentInput[lead.id] ?? ""}
                onChange={(e) =>
                  setPaymentInput((prev) => ({ ...prev, [lead.id]: e.target.value }))
                }
              />
              <button
                className="rounded border border-amber-400/50 px-3 py-2 text-amber-100"
                onClick={() => recordCamshotPayment(lead.id)}
              >
                Save Payment
              </button>
              <button
                className="rounded border border-amber-400/50 px-3 py-2 text-amber-100"
                onClick={() => generateCamshotUpiQr(lead)}
              >
                Generate UPI QR
              </button>
              <button
                className="rounded border border-amber-400/50 px-3 py-2 text-amber-100"
                onClick={() => sendCamshotWhatsapp(lead)}
              >
                WhatsApp Reminder
              </button>
              <button
                className={`rounded px-3 py-2 ${
                  due === 0
                    ? "bg-amber-400 text-black"
                    : "cursor-not-allowed border border-amber-400/40 text-amber-300/50"
                }`}
                disabled={due > 0}
                onClick={() => downloadCamshotPhotos(lead)}
              >
                Download For Customer
              </button>
            </div>

            {activeLeadId === lead.id && upiQr && (
              <img src={upiQr} alt="UPI QR" className="h-40 w-40 rounded bg-white p-2" />
            )}
          </div>
        );
      })}
    </div>
  </section>
)}

                {active === "Settings" && (
                  <section className="space-y-5">
                    <h2 className="text-xl font-semibold">Settings + QR + Invoice Export</h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <Input label="Studio Name" value={settings.studioName} onChange={(v) => setSettings((s) => ({ ...s, studioName: v }))} />
                        <Input label="Tagline" value={settings.tagline} onChange={(v) => setSettings((s) => ({ ...s, tagline: v }))} />
                        <Input label="WhatsApp Number" value={settings.whatsappNumber} onChange={(v) => setSettings((s) => ({ ...s, whatsappNumber: v }))} />
                        <Input label="UPI ID" value={settings.upiId} onChange={(v) => setSettings((s) => ({ ...s, upiId: v }))} />
                        <Input label="GSTIN" value={settings.gstin} onChange={(v) => setSettings((s) => ({ ...s, gstin: v }))} />
                        <Input label="Address" value={settings.address} onChange={(v) => setSettings((s) => ({ ...s, address: v }))} />
                      </div>

                      <div className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
                        <p className="mb-2 text-sm uppercase tracking-wider text-[#bda25f]">Invoice Payment QR</p>
                        <select
                          className="mb-4 w-full rounded border border-[#6d582a] bg-[#140f1d] px-3 py-2 text-sm"
                          value={invoiceOrderId}
                          onChange={(e) => setInvoiceOrderId(e.target.value)}
                        >
                          {orders.map((order) => {
                            const due = order.amount - order.paid;
                            return <option key={order.id} value={order.id}>{order.title} - Due {money(Math.max(due, 0))}</option>;
                          })}
                        </select>
                        {qrDataUrl && <img src={qrDataUrl} alt="UPI payment QR" className="mx-auto rounded border border-[#594720]" />}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="rounded bg-[#d4af37] px-3 py-2 text-xs font-semibold text-[#261b08]"
                            onClick={() => {
                              const invoiceOrder = orders.find((o) => o.id === invoiceOrderId);
                              if (!invoiceOrder) return;
                              const due = invoiceOrder.amount - invoiceOrder.paid;
                              sendWhatsApp(settings.whatsappNumber, `Pay ${money(due)} to ${settings.upiId} for ${invoiceOrder.title}.`);
                            }}
                          >
                            Share Payment on WhatsApp
                          </button>
                          <button
                            className="rounded border border-[#745d2b] px-3 py-2 text-xs"
                            onClick={() => {
                              const invoiceOrder = orders.find((o) => o.id === invoiceOrderId);
                              if (invoiceOrder) exportInvoicePdf(invoiceOrder);
                            }}
                          >
                            Export Invoice PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#4a3b1d] bg-[#130e1d] p-4">
      <p className="text-xs uppercase tracking-widest text-[#b99a54]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#f6e8be]">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[#d0b97a]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2" />
    </label>
  );
}

function ClientsSection({
  clients,
  setClients,
  orders,
  sendWhatsApp,
}: {
  clients: Client[];
  setClients: Dispatch<SetStateAction<Client[]>>;
  orders: Order[];
  sendWhatsApp: (phone: string, message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("Wedding");

  const filtered = clients.filter((c) => [c.name, c.phone, c.eventType].join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Clients (CRM)</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm">
          <option>Wedding</option>
          <option>Pre-Wedding</option>
          <option>Event</option>
          <option>Maternity</option>
        </select>
        <button
          onClick={() => {
            if (!name || !phone) return;
            setClients((prev) => [{ id: makeId(), name, phone, email: "", eventType, totalSpent: 0, createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
            setName("");
            setPhone("");
          }}
          className="rounded bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#221807]"
        >
          Add Client
        </button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="w-full rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <div className="space-y-2">
        {filtered.map((client) => (
          <div key={client.id} className="flex items-center justify-between rounded-md border border-[#4a3b1d] bg-[#130e1d] p-3 text-sm">
            <div>
              <p className="font-medium">{client.name}</p>
              <p className="text-[#d4be7a]">{client.eventType} • {client.phone} • Orders: {orders.filter((order) => order.clientId === client.id).length}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded border border-[#6e592d] px-2 py-1 text-xs" onClick={() => sendWhatsApp(client.phone, `Hi ${client.name}, thanks for choosing s.h_photography11.`)}>WhatsApp</button>
              <button className="rounded border border-[#6e592d] px-2 py-1 text-xs" onClick={() => setClients((prev) => prev.filter((c) => c.id !== client.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrdersSection({
  clients,
  orders,
  setOrders,
  sendWhatsApp,
  exportInvoicePdf,
}: {
  clients: Client[];
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  sendWhatsApp: (phone: string, message: string) => void;
  exportInvoicePdf: (order: Order) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [title, setTitle] = useState("Wedding Shoot");
  const [date, setDate] = useState("2025-04-24");
  const [amount, setAmount] = useState(45000);

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Orders</h2>
      <div className="grid gap-3 md:grid-cols-5">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm">
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
        <button
          onClick={() => setOrders((prev) => [{ id: makeId(), clientId, title, date, venue: "TBD", amount, paid: 0, status: "Pending" }, ...prev])}
          className="rounded bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#251a0a]"
        >
          Book Shoot
        </button>
      </div>
      <div className="space-y-2">
        {orders.map((order) => {
          const client = clients.find((c) => c.id === order.clientId);
          const due = order.amount - order.paid;
          return (
            <div key={order.id} className="grid gap-2 rounded-md border border-[#4a3b1d] bg-[#130e1d] p-3 text-sm md:grid-cols-[1.8fr_1fr_1fr_1fr_auto] md:items-center">
              <div>
                <p className="font-medium">{order.title} - {client?.name}</p>
                <p className="text-[#d0b978]">{order.date} • {money(order.amount)}</p>
              </div>
              <select value={order.status} onChange={(e) => setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: e.target.value as OrderStatus } : o)))} className="rounded border border-[#6a5428] bg-[#100d16] px-2 py-1 text-xs">
                <option>Pending</option>
                <option>Confirmed</option>
                <option>Completed</option>
              </select>
              <button className="rounded border border-[#6a5428] px-2 py-1 text-xs" onClick={() => setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, paid: Math.min(o.amount, o.paid + 5000) } : o)))}>
                + Record INR 5,000
              </button>
              <span className="text-xs text-[#f2dd9f]">Due: {money(Math.max(due, 0))}</span>
              <div className="flex gap-2">
                <button className="rounded border border-[#6a5428] px-2 py-1 text-xs" onClick={() => client?.phone && sendWhatsApp(client.phone, `Your order ${order.title} is ${order.status}. Balance: ${money(due)}.`)}>WhatsApp</button>
                <button className="rounded border border-[#6a5428] px-2 py-1 text-xs" onClick={() => exportInvoicePdf(order)}>PDF</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExpenseForm({ setExpenses }: { setExpenses: Dispatch<SetStateAction<Expense[]>> }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("General");
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Expense title" className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Amount" className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <button
        onClick={() => {
          if (!title || !amount) return;
          setExpenses((prev) => [{ id: makeId(), title, amount, category, date: new Date().toISOString().slice(0, 10) }, ...prev]);
          setTitle("");
          setAmount(0);
        }}
        className="rounded bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#251a0a]"
      >
        Add Expense
      </button>
    </div>
  );
}

function AlbumForm({ clients, setAlbums }: { clients: Client[]; setAlbums: Dispatch<SetStateAction<Album[]>> }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("New Client Album");
  const [count, setCount] = useState(200);
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm">
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded border border-[#6a5428] bg-[#110d1a] px-3 py-2 text-sm" />
      <button
        onClick={() => setAlbums((prev) => [{ id: makeId(), clientId, name, totalPhotos: count, selectedPhotos: 0, delivered: false }, ...prev])}
        className="rounded bg-[#d4af37] px-3 py-2 text-sm font-semibold text-[#251a0a]"
      >
        Create Album
      </button>
    </div>
  );
}
