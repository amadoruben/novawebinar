# Remix of Webinar Flow Studio

Copy-paste this component to /components/ui folder:

```tsx

dashboard-sidebar.tsx

import React, { useState } from 'react';

import { 

  Search, 

  LayoutDashboard, 

  FolderKanban, 

  Users, 

  Settings, 

  LogOut,

  Hash,

  ChevronDown,

  ChevronRight,

  Inbox,

  Calendar,

  Activity,

  CreditCard,

  Globe,

  Terminal,

  Blocks,

  PanelLeftClose,

  PanelLeftOpen,

  Command,

  X

} from 'lucide-react';

export type NavItemData = {

  id: string;

  title: string;

  icon: React.ElementType;

  badge?: number | string;

  shortcut?: string;

  children?: NavItemData[];

};

export type NavGroupData = {

  heading?: string;

  items: NavItemData[];

};

const mockNavGroups: NavGroupData[] = [

  {

    items: [

      { id: 'search', title: 'Search', icon: Search, shortcut: '⌘K' },

      { id: 'home', title: 'Home', icon: LayoutDashboard },

      { id: 'inbox', title: 'Inbox', icon: Inbox, badge: 12 },

      { id: 'analytics', title: 'Analytics', icon: Activity },

    ]

  },

  {

    heading: 'Workspace',

    items: [

      { 

        id: 'projects', 

        title: 'Projects', 

        icon: FolderKanban,

        children: [

          { id: 'p-active', title: 'Active', icon: Hash },

          { id: 'p-archived', title: 'Archived', icon: Hash },

        ]

      },

      { id: 'calendar', title: 'Calendar', icon: Calendar },

      { 

        id: 'team', 

        title: 'Team', 

        icon: Users,

        children: [

          { id: 't-design', title: 'Designers', icon: Hash },

          { id: 't-eng', title: 'Engineering', icon: Hash },

          { id: 't-product', title: 'Product', icon: Hash },

        ]

      },

      { 

        id: 'customers', 

        title: 'Customers', 

        icon: Globe,

        children: [

          { id: 'c-enterprise', title: 'Enterprise', icon: Hash },

          { id: 'c-smb', title: 'SMB', icon: Hash },

        ]

      },

      { id: 'finance', title: 'Finance', icon: CreditCard },

    ]

  },

  {

    heading: 'Developers',

    items: [

      { id: 'api', title: 'API Keys', icon: Terminal },

      { id: 'webhooks', title: 'Webhooks', icon: Blocks },

    ]

  }

];

const mockBottomItems: NavItemData[] = [

  { id: 'settings', title: 'Settings', icon: Settings, shortcut: '⌘,' },

  { id: 'logout', title: 'Log out', icon: LogOut },

];

function WorkspaceSwitcher({ selected, onSelect }: { selected?: string, onSelect?: (ws: string) => void }) {

  const [isOpen, setIsOpen] = useState(false);

  const [internalSelected, setInternalSelected] = useState('Acme Corp');

  

  const current = selected || internalSelected;

  const handleSelect = onSelect || setInternalSelected;

  return (

    <div className="relative">

      <div 

        onClick={() => setIsOpen(!isOpen)}

        className="flex items-center justify-between px-2 py-2 mb-4 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors select-none group"

      >

        <div className="flex items-center gap-3">

          <div className="w-8 h-8 rounded-[6px] bg-primary text-primary-foreground flex items-center justify-center font-semibold text-[13px] shadow-sm">

            {current.charAt(0)}

          </div>

          <div className="flex flex-col overflow-hidden">

            <span className="text-[13px] font-medium leading-none mb-1 text-foreground truncate max-w-[120px]">{current}</span>

            <span className="text-[11px] text-muted-foreground leading-none">Pro Plan</span>

          </div>

        </div>

        <ChevronDown className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors shrink-0" strokeWidth={1.5} />

      </div>

      {isOpen && (

        <>

          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute top-[52px] left-0 w-full bg-card border border-border/50 rounded-lg shadow-xl z-50 py-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">

            {['Acme Corp', 'Personal Workspace', 'Client Sandbox'].map(ws => (

              <div 

                key={ws}

                onClick={() => { handleSelect(ws); setIsOpen(false); }}

                className={`px-3 py-2 mx-1 text-[13px] rounded-md cursor-pointer transition-colors ${current === ws ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5'}`}

              >

                {ws}

              </div>

            ))}

            <div className="h-px bg-border/50 my-1 mx-2" />

            <div className="px-3 py-2 mx-1 text-[13px] text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-md cursor-pointer flex items-center gap-2 transition-colors">

              <span className="text-[16px] leading-none mb-0.5">+</span> Create Workspace

            </div>

          </div>

        </>

      )}

    </div>

  );

}

function NavItem({ 

  item, 

  activeId, 

  onSelect,

  level = 0

}: { 

  item: NavItemData; 

  activeId: string; 

  onSelect: (id: string) => void;

  level?: number;

}) {

  const isActive = activeId === item.id;

  const hasChildren = !!item.children;

  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {

    if (hasChildren) {

      setIsOpen(!isOpen);

    } else {

      onSelect(item.id);

    }

  };

  return (

    <div className="flex flex-col w-full">

      <div 

        className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none

          ${isActive 

            ? 'bg-black/5 dark:bg-white/10 text-foreground font-medium' 

            : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground/90'

          }

        `}

        style={{ paddingLeft: `${level * 12 + 10}px` }}

        onClick={handleClick}

      >

        <div className="flex items-center gap-2.5">

          <item.icon 

            className={`w-[16px] h-[16px] transition-colors

              ${isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/70'}

            `} 

            strokeWidth={1.5} 

          />

          <span className="text-[13px] tracking-wide truncate">

            {item.title}

          </span>

        </div>

        

        <div className="flex items-center gap-2">

          {item.shortcut && (

             <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-muted-foreground/60 bg-background/50 border border-border/50 rounded-[4px] shadow-xs">

               {item.shortcut}

             </kbd>

          )}

          {item.badge && (

            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">

              {item.badge}

            </span>

          )}

          {hasChildren && (

            <ChevronRight 

              className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 

              strokeWidth={2}

            />

          )}

        </div>

      </div>

      {hasChildren && (

        <div 

          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${

            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'

          }`}

        >

          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">

            <div 

              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"

              style={{ left: `${level * 12 + 17.5}px` }}

            />

            {item.children!.map(child => (

              <NavItem 

                key={child.id} 

                item={child} 

                activeId={activeId} 

                onSelect={onSelect} 

                level={level + 1} 

              />

            ))}

          </div>

        </div>

      )}

    </div>

  );

}

export function SidebarNav({ 

  className = '',

  activeId,

  onSelect,

  activeWorkspace,

  onWorkspaceSelect

}: { 

  className?: string,

  activeId?: string,

  onSelect?: (id: string) => void,

  activeWorkspace?: string,

  onWorkspaceSelect?: (ws: string) => void

}) {

  const [internalId, setInternalId] = useState('home');

  const currentId = activeId !== undefined ? activeId : internalId;

  const handleSelect = onSelect || setInternalId;

  return (

    <div className={`flex flex-col w-[260px] h-full bg-card/50 border-r border-border/50 p-3 font-sans ${className}`}>

      <WorkspaceSwitcher selected={activeWorkspace} onSelect={onWorkspaceSelect} />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4 mt-2">

        {mockNavGroups.map((group, idx) => (

          <div key={idx} className="flex flex-col gap-0.5">

            {group.heading && (

              <span className="px-2.5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">

                {group.heading}

              </span>

            )}

            {group.items.map(item => (

              <NavItem 

                key={item.id} 

                item={item} 

                activeId={currentId} 

                onSelect={handleSelect} 

              />

            ))}

          </div>

        ))}

      </div>

      <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-0.5">

        {mockBottomItems.map(item => (

          <NavItem 

            key={item.id} 

            item={item} 

            activeId={currentId} 

            onSelect={handleSelect} 

          />

        ))}

      </div>

    </div>

  );

}

const allItems = [...mockNavGroups.flatMap(g => g.items), ...mockBottomItems];

const flattenItems = (items: NavItemData[]): NavItemData[] => {

  return items.reduce((acc, item) => {

    acc.push(item);

    if (item.children) acc.push(...flattenItems(item.children));

    return acc;

  }, [] as NavItemData[]);

};

const flatMockData = flattenItems(allItems);

export default function SidebarNavPreview() {

  const [isOpen, setIsOpen] = useState(true);

  const [activeId, setActiveId] = useState('home');

  const [activeWorkspace, setActiveWorkspace] = useState('Acme Corp');

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeItem = flatMockData.find(i => i.id === activeId);

  const activeTitle = activeItem ? activeItem.title : 'Dashboard';

  const handleSelect = (id: string) => {

    if (id === 'search') {

      setIsSearchOpen(true);

      return;

    }

    setActiveId(id);

  };

  return (

    <div className="flex flex-col items-center justify-center w-full min-h-[700px] bg-background p-4 md:p-8">

      

      

      <div className="relative w-full max-w-4xl h-[700px] bg-card rounded-xl border border-border/50 flex overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5">

        

        

        <div 

          className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-card/50 border-r border-border/50 ${

            isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'

          }`}

        >

          

          <SidebarNav 

            className="w-[260px] border-none bg-transparent" 

            activeId={activeId}

            onSelect={handleSelect}

            activeWorkspace={activeWorkspace}

            onWorkspaceSelect={setActiveWorkspace}

          />

        </div>

        

        

        <div className="flex-1 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col min-w-0 transition-all duration-300">

           

           

           <div className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card shrink-0">

             <div className="flex items-center gap-3">

               <button 

                 onClick={() => setIsOpen(!isOpen)}

                 className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"

               >

                 {isOpen ? <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}

               </button>

               <div className="flex items-center gap-2 text-sm text-muted-foreground">

                 <span className="truncate">{activeWorkspace}</span>

                 <span>/</span>

                 <span className="font-medium text-foreground truncate">{activeTitle}</span>

               </div>

             </div>

             

             <div className="flex items-center gap-3">

               <div className="w-64 h-8 bg-black/5 dark:bg-white/5 rounded-md hidden md:block" />

               <div className="w-8 h-8 bg-primary/10 rounded-full border border-primary/20" />

             </div>

           </div>

           

           <div className="p-6 md:p-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

             <div className="flex items-center justify-between mb-8">

               <div className="w-48 h-8 bg-black/5 dark:bg-white/5 rounded-md" />

             </div>

             

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />

               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />

             </div>

             <div className="w-full bg-card rounded-xl border border-border/50 shadow-sm p-6">

                <div className="w-1/3 h-5 bg-black/5 dark:bg-white/5 rounded-md mb-6" />

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                

                <div className="flex flex-col gap-4">

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

               </div>

             </div>

           </div>

        </div>

        

        {isSearchOpen && (

          <div className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/40 backdrop-blur-sm px-4">

            <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />

            <div className="relative w-full max-w-xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              <div className="flex items-center px-4 border-b border-border/50">

                <Search className="w-[18px] h-[18px] text-muted-foreground/70 mr-3 shrink-0" strokeWidth={1.5} />

                <input 

                  autoFocus

                  className="flex-1 bg-transparent py-4 outline-none text-[14px] text-foreground placeholder:text-muted-foreground/50"

                  placeholder="Search projects, docs, or actions..."

                />

                <kbd 

                  onClick={() => setIsSearchOpen(false)}

                  className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 ml-2 text-[10px] font-medium font-mono text-muted-foreground/70 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-[4px] cursor-pointer hover:text-foreground hover:bg-black/10 dark:hover:bg-white/20 transition-colors"

                >

                  ESC

                </kbd>

                <button 

                  onClick={() => setIsSearchOpen(false)}

                  className="ml-3 p-1 rounded-md text-muted-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors"

                >

                  <X className="w-[18px] h-[18px]" strokeWidth={1.5} />

                </button>

              </div>

              <div className="p-2 py-8 flex flex-col items-center justify-center">

                 <Command className="w-6 h-6 text-muted-foreground/30 mb-2" strokeWidth={1.5} />

                 <p className="text-[13px] text-muted-foreground font-medium">Type a command or search...</p>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}

demo.tsx

import React, { useState } from 'react';

import { 

  Search, 

  LayoutDashboard, 

  FolderKanban, 

  Users, 

  Settings, 

  LogOut,

  Hash,

  ChevronDown,

  ChevronRight,

  Inbox,

  Calendar,

  Activity,

  CreditCard,

  Globe,

  Terminal,

  Blocks,

  PanelLeftClose,

  PanelLeftOpen,

  Command,

  X

} from 'lucide-react';

export type NavItemData = {

  id: string;

  title: string;

  icon: React.ElementType;

  badge?: number | string;

  shortcut?: string;

  children?: NavItemData[];

};

export type NavGroupData = {

  heading?: string;

  items: NavItemData[];

};

const mockNavGroups: NavGroupData[] = [

  {

    items: [

      { id: 'search', title: 'Search', icon: Search, shortcut: '⌘K' },

      { id: 'home', title: 'Home', icon: LayoutDashboard },

      { id: 'inbox', title: 'Inbox', icon: Inbox, badge: 12 },

      { id: 'analytics', title: 'Analytics', icon: Activity },

    ]

  },

  {

    heading: 'Workspace',

    items: [

      { 

        id: 'projects', 

        title: 'Projects', 

        icon: FolderKanban,

        children: [

          { id: 'p-active', title: 'Active', icon: Hash },

          { id: 'p-archived', title: 'Archived', icon: Hash },

        ]

      },

      { id: 'calendar', title: 'Calendar', icon: Calendar },

      { 

        id: 'team', 

        title: 'Team', 

        icon: Users,

        children: [

          { id: 't-design', title: 'Designers', icon: Hash },

          { id: 't-eng', title: 'Engineering', icon: Hash },

          { id: 't-product', title: 'Product', icon: Hash },

        ]

      },

      { 

        id: 'customers', 

        title: 'Customers', 

        icon: Globe,

        children: [

          { id: 'c-enterprise', title: 'Enterprise', icon: Hash },

          { id: 'c-smb', title: 'SMB', icon: Hash },

        ]

      },

      { id: 'finance', title: 'Finance', icon: CreditCard },

    ]

  },

  {

    heading: 'Developers',

    items: [

      { id: 'api', title: 'API Keys', icon: Terminal },

      { id: 'webhooks', title: 'Webhooks', icon: Blocks },

    ]

  }

];

const mockBottomItems: NavItemData[] = [

  { id: 'settings', title: 'Settings', icon: Settings, shortcut: '⌘,' },

  { id: 'logout', title: 'Log out', icon: LogOut },

];

function WorkspaceSwitcher({ selected, onSelect }: { selected?: string, onSelect?: (ws: string) => void }) {

  const [isOpen, setIsOpen] = useState(false);

  const [internalSelected, setInternalSelected] = useState('Acme Corp');

  

  const current = selected || internalSelected;

  const handleSelect = onSelect || setInternalSelected;

  return (

    <div className="relative">

      <div 

        onClick={() => setIsOpen(!isOpen)}

        className="flex items-center justify-between px-2 py-2 mb-4 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors select-none group"

      >

        <div className="flex items-center gap-3">

          <div className="w-8 h-8 rounded-[6px] bg-primary text-primary-foreground flex items-center justify-center font-semibold text-[13px] shadow-sm">

            {current.charAt(0)}

          </div>

          <div className="flex flex-col overflow-hidden">

            <span className="text-[13px] font-medium leading-none mb-1 text-foreground truncate max-w-[120px]">{current}</span>

            <span className="text-[11px] text-muted-foreground leading-none">Pro Plan</span>

          </div>

        </div>

        <ChevronDown className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors shrink-0" strokeWidth={1.5} />

      </div>

      {isOpen && (

        <>

          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute top-[52px] left-0 w-full bg-card border border-border/50 rounded-lg shadow-xl z-50 py-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">

            {['Acme Corp', 'Personal Workspace', 'Client Sandbox'].map(ws => (

              <div 

                key={ws}

                onClick={() => { handleSelect(ws); setIsOpen(false); }}

                className={`px-3 py-2 mx-1 text-[13px] rounded-md cursor-pointer transition-colors ${current === ws ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5'}`}

              >

                {ws}

              </div>

            ))}

            <div className="h-px bg-border/50 my-1 mx-2" />

            <div className="px-3 py-2 mx-1 text-[13px] text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-md cursor-pointer flex items-center gap-2 transition-colors">

              <span className="text-[16px] leading-none mb-0.5">+</span> Create Workspace

            </div>

          </div>

        </>

      )}

    </div>

  );

}

function NavItem({ 

  item, 

  activeId, 

  onSelect,

  level = 0

}: { 

  item: NavItemData; 

  activeId: string; 

  onSelect: (id: string) => void;

  level?: number;

}) {

  const isActive = activeId === item.id;

  const hasChildren = !!item.children;

  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {

    if (hasChildren) {

      setIsOpen(!isOpen);

    } else {

      onSelect(item.id);

    }

  };

  return (

    <div className="flex flex-col w-full">

      <div 

        className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none

          ${isActive 

            ? 'bg-black/5 dark:bg-white/10 text-foreground font-medium' 

            : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground/90'

          }

        `}

        style={{ paddingLeft: `${level * 12 + 10}px` }}

        onClick={handleClick}

      >

        <div className="flex items-center gap-2.5">

          <item.icon 

            className={`w-[16px] h-[16px] transition-colors

              ${isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/70'}

            `} 

            strokeWidth={1.5} 

          />

          <span className="text-[13px] tracking-wide truncate">

            {item.title}

          </span>

        </div>

        

        <div className="flex items-center gap-2">

          {item.shortcut && (

             <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-muted-foreground/60 bg-background/50 border border-border/50 rounded-[4px] shadow-xs">

               {item.shortcut}

             </kbd>

          )}

          {item.badge && (

            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">

              {item.badge}

            </span>

          )}

          {hasChildren && (

            <ChevronRight 

              className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 

              strokeWidth={2}

            />

          )}

        </div>

      </div>

      {hasChildren && (

        <div 

          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${

            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'

          }`}

        >

          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">

            <div 

              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"

              style={{ left: `${level * 12 + 17.5}px` }}

            />

            {item.children!.map(child => (

              <NavItem 

                key={child.id} 

                item={child} 

                activeId={activeId} 

                onSelect={onSelect} 

                level={level + 1} 

              />

            ))}

          </div>

        </div>

      )}

    </div>

  );

}

export function SidebarNav({ 

  className = '',

  activeId,

  onSelect,

  activeWorkspace,

  onWorkspaceSelect

}: { 

  className?: string,

  activeId?: string,

  onSelect?: (id: string) => void,

  activeWorkspace?: string,

  onWorkspaceSelect?: (ws: string) => void

}) {

  const [internalId, setInternalId] = useState('home');

  const currentId = activeId !== undefined ? activeId : internalId;

  const handleSelect = onSelect || setInternalId;

  return (

    <div className={`flex flex-col w-[260px] h-full bg-card/50 border-r border-border/50 p-3 font-sans ${className}`}>

      <WorkspaceSwitcher selected={activeWorkspace} onSelect={onWorkspaceSelect} />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4 mt-2">

        {mockNavGroups.map((group, idx) => (

          <div key={idx} className="flex flex-col gap-0.5">

            {group.heading && (

              <span className="px-2.5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">

                {group.heading}

              </span>

            )}

            {group.items.map(item => (

              <NavItem 

                key={item.id} 

                item={item} 

                activeId={currentId} 

                onSelect={handleSelect} 

              />

            ))}

          </div>

        ))}

      </div>

      <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-0.5">

        {mockBottomItems.map(item => (

          <NavItem 

            key={item.id} 

            item={item} 

            activeId={currentId} 

            onSelect={handleSelect} 

          />

        ))}

      </div>

    </div>

  );

}

const allItems = [...mockNavGroups.flatMap(g => g.items), ...mockBottomItems];

const flattenItems = (items: NavItemData[]): NavItemData[] => {

  return items.reduce((acc, item) => {

    acc.push(item);

    if (item.children) acc.push(...flattenItems(item.children));

    return acc;

  }, [] as NavItemData[]);

};

const flatMockData = flattenItems(allItems);

export default function SidebarNavPreview() {

  const [isOpen, setIsOpen] = useState(true);

  const [activeId, setActiveId] = useState('home');

  const [activeWorkspace, setActiveWorkspace] = useState('Acme Corp');

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeItem = flatMockData.find(i => i.id === activeId);

  const activeTitle = activeItem ? activeItem.title : 'Dashboard';

  const handleSelect = (id: string) => {

    if (id === 'search') {

      setIsSearchOpen(true);

      return;

    }

    setActiveId(id);

  };

  return (

    <div className="flex flex-col items-center justify-center w-full min-h-[700px] bg-background p-4 md:p-8">

      

      

      <div className="relative w-full max-w-4xl h-[700px] bg-card rounded-xl border border-border/50 flex overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5">

        

        

        <div 

          className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-card/50 border-r border-border/50 ${

            isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'

          }`}

        >

          

          <SidebarNav 

            className="w-[260px] border-none bg-transparent" 

            activeId={activeId}

            onSelect={handleSelect}

            activeWorkspace={activeWorkspace}

            onWorkspaceSelect={setActiveWorkspace}

          />

        </div>

        

        

        <div className="flex-1 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col min-w-0 transition-all duration-300">

           

           

           <div className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card shrink-0">

             <div className="flex items-center gap-3">

               <button 

                 onClick={() => setIsOpen(!isOpen)}

                 className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"

               >

                 {isOpen ? <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}

               </button>

               <div className="flex items-center gap-2 text-sm text-muted-foreground">

                 <span className="truncate">{activeWorkspace}</span>

                 <span>/</span>

                 <span className="font-medium text-foreground truncate">{activeTitle}</span>

               </div>

             </div>

             

             <div className="flex items-center gap-3">

               <div className="w-64 h-8 bg-black/5 dark:bg-white/5 rounded-md hidden md:block" />

               <div className="w-8 h-8 bg-primary/10 rounded-full border border-primary/20" />

             </div>

           </div>

           

           <div className="p-6 md:p-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

             <div className="flex items-center justify-between mb-8">

               <div className="w-48 h-8 bg-black/5 dark:bg-white/5 rounded-md" />

             </div>

             

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />

               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />

             </div>

             <div className="w-full bg-card rounded-xl border border-border/50 shadow-sm p-6">

                <div className="w-1/3 h-5 bg-black/5 dark:bg-white/5 rounded-md mb-6" />

                <div className="w-full h-[1px] bg-border/50 mb-6" />

                

                <div className="flex flex-col gap-4">

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />

               </div>

             </div>

           </div>

        </div>

        

        {isSearchOpen && (

          <div className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/40 backdrop-blur-sm px-4">

            <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />

            <div className="relative w-full max-w-xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              <div className="flex items-center px-4 border-b border-border/50">

                <Search className="w-[18px] h-[18px] text-muted-foreground/70 mr-3 shrink-0" strokeWidth={1.5} />

                <input 

                  autoFocus

                  className="flex-1 bg-transparent py-4 outline-none text-[14px] text-foreground placeholder:text-muted-foreground/50"

                  placeholder="Search projects, docs, or actions..."

                />

                <kbd 

                  onClick={() => setIsSearchOpen(false)}

                  className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 ml-2 text-[10px] font-medium font-mono text-muted-foreground/70 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-[4px] cursor-pointer hover:text-foreground hover:bg-black/10 dark:hover:bg-white/20 transition-colors"

                >

                  ESC

                </kbd>

                <button 

                  onClick={() => setIsSearchOpen(false)}

                  className="ml-3 p-1 rounded-md text-muted-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors"

                >

                  <X className="w-[18px] h-[18px]" strokeWidth={1.5} />

                </button>

              </div>

              <div className="p-2 py-8 flex flex-col items-center justify-center">

                 <Command className="w-6 h-6 text-muted-foreground/30 mb-2" strokeWidth={1.5} />

                 <p className="text-[13px] text-muted-foreground font-medium">Type a command or search...</p>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}

```

Install NPM dependencies:

```bash

lucide-react

```




Quero criar um novo projeto SaaS chamado NovaWebinar.

IMPORTANTE:

Este é um projeto NOVO. Não existe landing page nesta fase.

Comece diretamente pela aplicação/dashboard autenticado.

Não invente funcionalidades além das especificadas abaixo.

Não implemente funcionalidades futuras.

Primeiro construa uma base visual e funcional muito bem organizada para que possamos evoluir o produto posteriormente.

==================================================

1. IDENTIDADE DO PRODUTO

==================================================

Nome: NovaWebinar

Slogan:

TRANSFORME AUDIÊNCIA EM VENDAS

A NovaWebinar é uma plataforma SaaS para criação e gestão de webinars automatizados.

O utilizador adiciona um vídeo previamente gravado, configura uma data e hora e cria uma experiência de webinar com:

- vídeo sincronizado com o horário da sessão

- chat

- comentários programados

- mensagens privadas dos participantes

- audiência configurável/simulada

- CTA programado

- replay

- analytics

IMPORTANTE:

Nesta primeira versão NÃO teremos transmissão real por webcam/WebRTC.

O modo "AO VIVO" é baseado num vídeo previamente configurado e sincronizado com a sessão.

==================================================

2. IDENTIDADE VISUAL

==================================================

Eu mesmo irei adicionar os ficheiros oficiais da marca NovaWebinar ao projeto.

Use esses assets como fonte principal da identidade.

Estilo visual:

- premium

- moderno

- SaaS

- tecnológico

- minimalista

- profissional

- forte

- focado em marketing e vendas

Paleta principal:

- preto / grafite muito escuro

- branco

- vermelho vivo

- vermelho profundo

- gradientes vermelho → laranja quando fizer sentido

O vermelho deve ser usado principalmente para:

- CTA principal

- item ativo

- indicadores importantes

- status AO VIVO

- gráficos/destaques

- elementos da identidade

Não deixar toda a interface vermelha.

O dashboard principal deve ser predominantemente claro para facilitar leitura, com sidebar escura e detalhes vermelhos.

Utilizar:

- cards modernos

- cantos arredondados

- sombras muito discretas

- bastante espaço

- hierarquia visual forte

- ícones modernos

- microinterações

- estados de hover

- loading/skeleton states

- empty states

- responsividade

Não quero aparência de template genérico.

Quero que pareça um SaaS premium pronto para comercialização.

==================================================

3. ESTRUTURA PRINCIPAL

==================================================

Criar sidebar fixa com:

Dashboard

Webinars

Calendário

Biblioteca de Vídeos

Chat e Interações

Participantes

Analytics

Configurações

Na parte inferior:

Plano atual

Ajuda

Perfil do utilizador

No topo:

pesquisa

notificações

ajuda

avatar/perfil

==================================================

4. DASHBOARD

==================================================

Criar uma página inicial muito visual.

Cabeçalho:

"Dashboard"

"Bem-vindo de volta, [Nome]"

Botão principal:

"+ Criar Webinar"

Adicionar área para um banner promocional da NovaWebinar.

Eu posteriormente colocarei a imagem oficial do banner.

Criar cards de métricas:

Visitantes

Assistiram ao webinar

Pico simultâneo REAL

Cliques no CTA

Conversões/Vendas, quando houver dados

Tempo médio assistido

Adicionar pequenos indicadores de evolução.

Abaixo:

"Seus Webinars"

Filtros:

Todos

Programados

Ao vivo

Replay

Finalizados

Rascunhos

Cada webinar deve mostrar:

- capa

- nome

- data/hora

- status

- espectadores reais

- pico real

- ações

Status possíveis:

RASCUNHO

AGENDADO

AO VIVO

REPLAY

FINALIZADO

Ações:

Visualizar

Editar

Analytics

Copiar link

Duplicar

Mais opções

Na lateral ou numa área secundária:

Próximo webinar

Calendário

Atalhos

==================================================

5. CRIAR WEBINAR

==================================================

Ao clicar em "+ Criar Webinar", abrir um fluxo passo a passo.

Usar um stepper no topo.

Etapas:

1. Informações

2. Vídeo

3. Agendamento

4. Chat e Engajamento

5. Aparência

6. Revisão

==================================================

6. ETAPA 1 — INFORMAÇÕES

==================================================

Campos:

Nome interno do webinar

Título público

Descrição

Capa/thumbnail

Idioma

Duração

Slug/URL

Exemplo:

novawebinar.com/live/workshop-marca-milionaria

Mostrar preview da URL.

==================================================

7. ETAPA 2 — VÍDEO

==================================================

Permitir duas opções principais:

UPLOAD DE VÍDEO

ou

USAR LINK EXTERNO

Para link externo preparar opções visuais para:

Bunny Stream

Panda Video

Vimeo

URL direta / HLS

Não é necessário implementar todas as APIs imediatamente se ainda não estiverem configuradas.

Estruture a arquitetura para providers de vídeo independentes.

Depois de adicionar o vídeo mostrar:

thumbnail

nome

duração

origem

status

E um player de preview.

==================================================

8. ETAPA 3 — AGENDAMENTO

==================================================

Permitir definir:

Data

Hora

Timezone

Replay:

Toggle:

"Disponibilizar Replay após o webinar"

IMPORTANTE SOBRE REPLAY:

Replay NÃO é uma gravação nova.

Replay utiliza EXATAMENTE o mesmo vídeo configurado para o webinar.

Quando a sessão termina e o replay está ativo:

o estado muda para REPLAY.

O mesmo vídeo passa a ser reproduzido desde o início e sob demanda.

Na página pública mostrar badge:

REPLAY

Durante a sessão mostrar:

AO VIVO

Não criar sistema de gravação para replay.

==================================================

9. COMPORTAMENTO DO MODO AO VIVO

==================================================

O webinar automatizado deve funcionar baseado no relógio da sessão.

Exemplo:

Webinar:

20:00

Duração:

90 minutos

Pessoa entra:

20:17

Ela deve entrar aproximadamente no minuto 17 do vídeo.

Não deve começar no minuto 0.

A posição é determinada por:

horário atual - horário de início da sessão

Durante AO VIVO:

não permitir que o participante avance livremente para partes futuras.

A experiência deve acompanhar a timeline da sessão.

==================================================

10. CHAT E INTERAÇÕES

==================================================

Criar um editor de chat.

Ter duas categorias diferentes:

A) COMENTÁRIOS PROGRAMADOS

B) MENSAGENS REAIS DOS PARTICIPANTES

Essas duas coisas NÃO podem ser misturadas no backend.

==================================================

11. COMENTÁRIOS PROGRAMADOS

==================================================

O organizador poderá criar comentários previamente.

Cada comentário possui:

tempo do vídeo

nome

avatar opcional

mensagem

tipo

Exemplo:

00:02:15

João

"Boa noite pessoal! 👋"

00:05:40

Carla

"Quem aqui está começando?"

00:17:30

Miguel

"Isso vale ouro 🔥"

Criar tabela/editor com:

Tempo

Nome

Avatar

Mensagem

Editar

Eliminar

Adicionar botão:

"+ Adicionar comentário"

Adicionar:

"Pré-visualizar timeline"

Esses comentários aparecem para TODOS os participantes quando a timeline chega naquele momento.

==================================================

12. MENSAGENS REAIS — PRIVADAS

==================================================

REGRA EXTREMAMENTE IMPORTANTE:

Quando um participante REAL escreve no chat durante o webinar, a mensagem NÃO deve ficar pública para os outros participantes.

Somente podem visualizar:

1. o próprio participante que enviou

2. o administrador/organizador

3. membros autorizados da equipa

Nenhum outro participante pode ver essa mensagem.

Para o participante que escreveu, a mensagem aparece naturalmente integrada ao seu chat.

Portanto cada participante tem uma espécie de conversa privada sobreposta aos comentários programados globais.

==================================================

13. ATENDIMENTO AO VIVO

==================================================

Criar uma página administrativa:

"Atendimento ao vivo"

Mostrar conversas dos participantes.

Filtros:

Todas

Aguardando resposta

Em atendimento

Resolvidas

Mostrar:

nome

última mensagem

horário

status

Ao abrir:

mostrar histórico da conversa daquele participante.

Campo:

"Digite sua resposta..."

Quando o administrador responde:

SOMENTE aquele participante recebe e vê a resposta.

Nunca publicar automaticamente a resposta para todos.

==================================================

14. AUDIÊNCIA

==================================================

Precisamos separar completamente:

AUDIÊNCIA REAL

e

AUDIÊNCIA SIMULADA/CONFIGURADA

Nunca misturar os dois nos analytics.

Audiência real:

medida pelas sessões reais dos participantes.

Audiência configurada:

número utilizado no modo de simulação/demonstração quando habilitado.

No editor criar:

"Audiência exibida"

Opções:

Mostrar audiência real

Modo de simulação/configuração

No modo configurável permitir criar uma curva.

Exemplo:

00:00 → 40

00:10 → 85

00:20 → 140

00:40 → 190

01:00 → 160

01:20 → 110

Criar uma interface gráfica simples para editar essa curva.

IMPORTANTE:

No banco de dados e analytics manter:

real_viewers

e

displayed/simulated_viewers

como conceitos completamente separados.

==================================================

15. CTA / OFERTA

==================================================

Permitir criar CTA programado.

Campos:

Texto do botão

URL

Momento de entrada

Momento de saída opcional

Exemplo:

00:48:30

"QUERO GARANTIR MINHA VAGA"

URL:

checkout externo

Na timeline configurada o botão aparece automaticamente.

Medir:

visualizações do CTA

cliques

CTR

==================================================

16. PÁGINA DA TRANSMISSÃO

==================================================

Criar a página pública do webinar.

Layout desktop:

vídeo grande à esquerda

chat à direita

Topo:

logo NovaWebinar ou branding configurado

badge AO VIVO / REPLAY

Mostrar audiência conforme configuração do webinar.

Chat ao lado.

CTA aparece quando a timeline determina.

No mobile:

vídeo no topo

chat abaixo

CTA fixo/visível quando ativo

A página precisa parecer uma transmissão profissional.

==================================================

17. REPLAY

==================================================

Quando estiver em Replay:

mostrar badge:

REPLAY

Usar o MESMO vídeo original.

No Replay permitir:

play

pause

avançar

retroceder

barra de progresso

começar do início

Não gerar outro ficheiro de vídeo.

==================================================

18. ANALYTICS

==================================================

Criar página de analytics por webinar.

Mostrar:

Visitantes únicos

Iniciaram webinar

Audiência real

Pico simultâneo real

Tempo médio assistido

Retenção média

Cliques CTA

CTR

Mensagens enviadas

Visualizações Live

Visualizações Replay

Criar gráfico:

RETENÇÃO DA AUDIÊNCIA

Eixo X:

timeline do vídeo

Eixo Y:

percentagem de audiência restante

Precisamos conseguir identificar onde as pessoas abandonaram o webinar.

Criar também:

origem dos acessos

dispositivo

Live vs Replay

IMPORTANTE:

Números simulados NUNCA devem entrar nos analytics reais.

==================================================

19. BIBLIOTECA DE VÍDEOS

==================================================

Criar página:

"Biblioteca de Vídeos"

Mostrar vídeos utilizados.

Cards/tabela:

thumbnail

nome

duração

provider

data

webinars associados

Filtros:

Todos

Upload

Bunny

Panda

Vimeo

URL externa

==================================================

20. CALENDÁRIO

==================================================

Criar calendário visual mostrando sessões.

Permitir:

mês

semana

Clicar numa sessão abre o webinar.

Status visual:

Programado

Ao vivo

Replay

Finalizado

==================================================

21. PARTICIPANTES

==================================================

Criar página de participantes.

Mostrar:

Nome

Email quando disponível

Webinar

Data

Tempo assistido

Live/Replay

CTA clicado

Status

Ao clicar num participante abrir detalhes.

==================================================

22. CONFIGURAÇÕES

==================================================

Criar página com abas:

Perfil

Empresa

Equipe

Notificações

Plano

Segurança

Nesta fase pode ser uma estrutura visual funcional básica.

==================================================

23. ARQUITETURA

==================================================

Criar arquitetura limpa e modular.

Separar claramente:

users

organizations/workspaces

webinars

webinar_sessions

video_sources

scheduled_comments

participants

private_conversations

private_messages

cta_events

viewer_sessions

analytics_events

audience_configuration

Não colocar tudo numa única tabela.

Preparar aplicação multi-tenant desde o início.

Cada workspace só pode acessar seus próprios dados.

Usar autenticação segura.

Nunca confiar no frontend para autorização.

==================================================

24. REALTIME

==================================================

Utilizar realtime para:

mensagens privadas

respostas da equipa

presença real

estado da sessão

Falha do chat não deve interromper reprodução do vídeo.

Analytics não devem bloquear a experiência do utilizador.

==================================================

25. DADOS DEMONSTRATIVOS

==================================================

Para conseguirmos visualizar o produto antes de conectar tudo, criar dados mock realistas.

Exemplos de webinars:

Workshop Marca Milionária

Vendas Automáticas com IA

Estratégias de Anúncios

Produtividade Máxima

Criar métricas demonstrativas.

Mas estruturar os componentes para posteriormente consumir dados reais.

==================================================

26. IMPORTANTE — NÃO IMPLEMENTAR AGORA

==================================================

NÃO criar:

landing page comercial

WebRTC

webcam ao vivo

Zoom-like meetings

RTMP live streaming

IA avançada

CRM completo

email marketing próprio

checkout próprio

gateway de pagamento

certificados

marketplace

aplicação mobile nativa

funis avançados

Essas funcionalidades NÃO pertencem à Fase 1.

==================================================

27. OBJETIVO DESTA PRIMEIRA EXECUÇÃO

==================================================

Primeiro quero que construa:

1. estrutura base da aplicação

2. identidade visual

3. sidebar/topbar

4. Dashboard

5. lista de Webinars

6. fluxo Criar Webinar

7. Editor do Webinar

8. Chat e Interações

9. Atendimento ao Vivo

10. Sala do participante

11. Replay

12. Analytics

13. Biblioteca

14. Calendário

15. Participantes

16. Configurações

Priorize UX e arquitetura.

Todos os botões principais devem navegar para destinos reais.

Não quero botões decorativos sem função quando a funcionalidade já estiver prevista.

Use componentes reutilizáveis.

Não altere a identidade NovaWebinar.

Não crie landing page.

Comece pelo produto autenticado.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f15ddfc2-836a-45f9-a46c-f9bce2b9acde).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
