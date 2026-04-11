import { NavLink, Outlet } from 'react-router'
import { navItems } from '../app/navigation'
import { StatusBar } from './StatusBar'

export function ShellLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Jarvis One Company OS</p>
          <h1>一人公司</h1>
        </div>

        <nav className="nav-list" aria-label="MVP 导航">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-title">当前主线</p>
          <ul>
            <li>验证一个真实赚钱场景</li>
            <li>6 角色协同 · Token 内部账本</li>
          </ul>
        </div>
      </aside>

      <main className="content">
        <StatusBar />
        <Outlet />
      </main>
    </div>
  )
}
