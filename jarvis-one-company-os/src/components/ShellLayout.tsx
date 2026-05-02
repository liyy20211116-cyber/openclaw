import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { navItems } from '../app/navigation'
import { StatusBar } from './StatusBar'

export function ShellLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <div>
              <p className="eyebrow">Jarvis One Company OS</p>
              <h1>一人公司</h1>
            </div>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav className="nav-list" aria-label="MVP 导航">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-card">
            <p className="sidebar-card-title">当前主线</p>
            <ul>
              <li>验证一个真实赚钱场景</li>
              <li>6 角色协同 · Token 内部账本</li>
            </ul>
          </div>
        )}
      </aside>

      <main className="content">
        <StatusBar />
        <Outlet />
      </main>
    </div>
  )
}
