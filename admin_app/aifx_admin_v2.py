#!/usr/bin/env python3
"""
AIFX Admin Dashboard v2 - Simple HTTP Client
簡化版，使用純 HTTP 請求，類似 Discord Bot 的連接方式
"""

import tkinter as tk
from tkinter import ttk, messagebox
import requests
import threading
import time

class AIFXAdmin:
    def __init__(self, root):
        self.root = root
        self.root.title("AIFX Admin Dashboard v2")
        self.root.geometry("900x650")
        self.root.minsize(800, 600)

        # 設定
        self.server_url = ""
        self.token = None
        self.current_view = 'overview'

        # 樣式
        self.setup_styles()

        # 顯示登入
        self.show_login()

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('Title.TLabel', font=('Arial', 18, 'bold'))
        style.configure('Header.TLabel', font=('Arial', 12, 'bold'))
        style.configure('Success.TLabel', foreground='green')
        style.configure('Error.TLabel', foreground='red')

    def show_login(self):
        """顯示登入畫面"""
        for widget in self.root.winfo_children():
            widget.destroy()

        frame = ttk.Frame(self.root, padding=40)
        frame.place(relx=0.5, rely=0.5, anchor='center')

        ttk.Label(frame, text="AIFX Admin v2", style='Title.TLabel').pack(pady=(0, 30))

        # 伺服器
        ttk.Label(frame, text="伺服器網址:").pack(anchor='w')
        self.url_var = tk.StringVar(value="https://heating-things-dsl-placing.trycloudflare.com")
        ttk.Entry(frame, textvariable=self.url_var, width=50).pack(pady=(5, 15))

        # 帳號
        ttk.Label(frame, text="帳號:").pack(anchor='w')
        self.user_var = tk.StringVar(value="admin")
        ttk.Entry(frame, textvariable=self.user_var, width=50).pack(pady=(5, 15))

        # 密碼
        ttk.Label(frame, text="密碼:").pack(anchor='w')
        self.pass_var = tk.StringVar()
        pw_entry = ttk.Entry(frame, textvariable=self.pass_var, width=50, show="*")
        pw_entry.pack(pady=(5, 20))
        pw_entry.bind('<Return>', lambda e: self.do_login())

        # 按鈕
        self.login_btn = ttk.Button(frame, text="登入", command=self.do_login)
        self.login_btn.pack(ipadx=20, ipady=5)

        # 狀態
        self.status_label = ttk.Label(frame, text="")
        self.status_label.pack(pady=15)

    def do_login(self):
        """執行登入"""
        self.server_url = self.url_var.get().rstrip('/')
        username = self.user_var.get()
        password = self.pass_var.get()

        if not all([self.server_url, username, password]):
            self.status_label.config(text="請填寫所有欄位", style='Error.TLabel')
            return

        self.login_btn.config(state='disabled')
        self.status_label.config(text="連接中...", style='')

        def login_thread():
            try:
                resp = requests.post(
                    f"{self.server_url}/api/v1/admin/login",
                    json={"username": username, "password": password},
                    timeout=15
                )
                data = resp.json()

                if data.get('success') and data.get('data', {}).get('token'):
                    self.token = data['data']['token']
                    self.root.after(0, self.show_main)
                else:
                    self.root.after(0, lambda: self.login_error(data.get('error', '登入失敗')))
            except requests.exceptions.Timeout:
                self.root.after(0, lambda: self.login_error("連線逾時"))
            except requests.exceptions.ConnectionError:
                self.root.after(0, lambda: self.login_error("無法連接伺服器"))
            except Exception as e:
                self.root.after(0, lambda: self.login_error(str(e)))

        threading.Thread(target=login_thread, daemon=True).start()

    def login_error(self, msg):
        self.status_label.config(text=msg, style='Error.TLabel')
        self.login_btn.config(state='normal')

    def api(self, method, endpoint, **kwargs):
        """發送 API 請求"""
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {self.token}'
        try:
            resp = requests.request(
                method,
                f"{self.server_url}/api/v1{endpoint}",
                headers=headers,
                timeout=15,
                **kwargs
            )
            return resp.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def show_main(self):
        """顯示主畫面"""
        for widget in self.root.winfo_children():
            widget.destroy()

        # 主框架
        main = ttk.Frame(self.root)
        main.pack(fill='both', expand=True)

        # 側邊欄
        sidebar = ttk.Frame(main, width=160)
        sidebar.pack(side='left', fill='y')
        sidebar.pack_propagate(False)

        ttk.Label(sidebar, text="AIFX Admin", style='Title.TLabel').pack(pady=20)

        buttons = [
            ("📊 總覽", lambda: self.show_view('overview')),
            ("👥 用戶", lambda: self.show_view('users')),
            ("📈 訊號", lambda: self.show_view('signals')),
            ("🤖 ML", lambda: self.show_view('ml')),
            ("🔄 刷新", self.refresh),
            ("🚪 登出", self.logout),
        ]
        for text, cmd in buttons:
            ttk.Button(sidebar, text=text, command=cmd, width=15).pack(pady=5, padx=10)

        # 內容區
        self.content = ttk.Frame(main)
        self.content.pack(side='right', fill='both', expand=True, padx=10, pady=10)

        self.show_view('overview')

    def clear_content(self):
        for w in self.content.winfo_children():
            w.destroy()

    def refresh(self):
        self.show_view(self.current_view)

    def show_view(self, view):
        self.current_view = view
        self.clear_content()

        # 載入中
        loading = ttk.Label(self.content, text="載入中...")
        loading.pack(pady=50)
        self.root.update()

        def load():
            if view == 'overview':
                health = self.api('GET', '/admin/health')
                stats = self.api('GET', '/admin/stats')
                self.root.after(0, lambda: self.render_overview(health, stats))
            elif view == 'users':
                data = self.api('GET', '/admin/users', params={'limit': 50})
                self.root.after(0, lambda: self.render_users(data))
            elif view == 'signals':
                data = self.api('GET', '/admin/signals', params={'limit': 50})
                self.root.after(0, lambda: self.render_signals(data))
            elif view == 'ml':
                models = self.api('GET', '/admin/ml/models')
                status = self.api('GET', '/admin/ml/status')
                self.root.after(0, lambda: self.render_ml(models, status))

        threading.Thread(target=load, daemon=True).start()

    def render_overview(self, health, stats):
        self.clear_content()

        ttk.Label(self.content, text="系統總覽", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        if not health.get('success') or not stats.get('success'):
            ttk.Label(self.content, text="無法取得資料", style='Error.TLabel').pack()
            return

        # 統計卡片
        cards_frame = ttk.Frame(self.content)
        cards_frame.pack(fill='x', pady=10)

        sd = stats.get('data') or {}
        users = sd.get('users') or {}
        signals = sd.get('signals') or {}

        cards = [
            ("用戶總數", users.get('total', 0)),
            ("活躍用戶", users.get('active', 0)),
            ("今日訊號", signals.get('today', 0)),
            ("訊號總數", signals.get('total', 0)),
        ]

        for i, (title, val) in enumerate(cards):
            card = ttk.LabelFrame(cards_frame, text=title, padding=10)
            card.grid(row=0, column=i, padx=8, pady=5, sticky='nsew')
            cards_frame.columnconfigure(i, weight=1)
            ttk.Label(card, text=str(val), font=('Arial', 20, 'bold')).pack()

        # 服務狀態
        ttk.Label(self.content, text="服務狀態", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        hd = health.get('data') or {}
        services = hd.get('services') or {}

        svc_frame = ttk.Frame(self.content)
        svc_frame.pack(fill='x')

        for name, label in [('postgres', 'PostgreSQL'), ('redis', 'Redis'), ('mlEngine', 'ML Engine')]:
            s = services.get(name, 'unknown')
            icon = "✅" if s == 'connected' else "❌" if s == 'disconnected' else "⚠️"
            row = ttk.Frame(svc_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=15).pack(side='left')
            ttk.Label(row, text=f"{icon} {s}").pack(side='left')

        # 系統資訊
        ttk.Label(self.content, text="系統資訊", style='Header.TLabel').pack(anchor='w', pady=(20, 10))

        uptime = hd.get('uptime', 0)
        mem = hd.get('memory', 0)

        info_frame = ttk.Frame(self.content)
        info_frame.pack(fill='x')

        infos = [
            ("運行時間", f"{int(uptime//3600)}小時 {int((uptime%3600)//60)}分"),
            ("記憶體", f"{mem//(1024*1024)} MB"),
            ("版本", hd.get('version', 'N/A')),
        ]
        for label, val in infos:
            row = ttk.Frame(info_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=15).pack(side='left')
            ttk.Label(row, text=val).pack(side='left')

    def render_users(self, data):
        self.clear_content()

        ttk.Label(self.content, text="用戶管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        if not data.get('success'):
            ttk.Label(self.content, text=f"錯誤: {data.get('error')}", style='Error.TLabel').pack()
            return

        result = data.get('data') or {}
        users = result.get('users') or []

        ttk.Label(self.content, text=f"共 {result.get('total', 0)} 位用戶").pack(anchor='w', pady=(0, 10))

        # 列表
        tree_frame = ttk.Frame(self.content)
        tree_frame.pack(fill='both', expand=True)

        cols = ('id', 'username', 'email', 'status', 'created')
        tree = ttk.Treeview(tree_frame, columns=cols, show='headings', height=15)

        for col, text, w in [('id', 'ID', 50), ('username', '用戶名', 120), ('email', 'Email', 200), ('status', '狀態', 80), ('created', '註冊日期', 100)]:
            tree.heading(col, text=text)
            tree.column(col, width=w)

        for u in users:
            status = "✅ 啟用" if u.get('isActive') else "❌ 停用"
            created = str(u.get('createdAt', ''))[:10]
            tree.insert('', 'end', values=(u.get('id'), u.get('username'), u.get('email'), status, created),
                       tags=(str(u.get('id')), str(u.get('isActive'))))

        scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        # 按鈕
        btn_frame = ttk.Frame(self.content)
        btn_frame.pack(fill='x', pady=10)

        def toggle():
            sel = tree.selection()
            if not sel:
                messagebox.showwarning("提示", "請選擇用戶")
                return
            item = tree.item(sel[0])
            uid = item['values'][0]
            active = item['tags'][1] == 'True'
            action = "停用" if active else "啟用"
            if messagebox.askyesno("確認", f"確定{action}此用戶?"):
                r = self.api('PUT', f'/admin/users/{uid}', json={'isActive': not active})
                if r.get('success'):
                    messagebox.showinfo("成功", f"已{action}")
                    self.show_view('users')
                else:
                    messagebox.showerror("錯誤", r.get('error', '失敗'))

        ttk.Button(btn_frame, text="啟用/停用", command=toggle).pack(side='left')

    def render_signals(self, data):
        self.clear_content()

        ttk.Label(self.content, text="訊號管理", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        if not data.get('success'):
            ttk.Label(self.content, text=f"錯誤: {data.get('error')}", style='Error.TLabel').pack()
            return

        result = data.get('data') or {}
        signals = result.get('signals') or []

        ttk.Label(self.content, text=f"共 {result.get('total', 0)} 個訊號").pack(anchor='w', pady=(0, 10))

        tree_frame = ttk.Frame(self.content)
        tree_frame.pack(fill='both', expand=True)

        cols = ('id', 'pair', 'dir', 'conf', 'entry', 'sl', 'tp', 'time')
        tree = ttk.Treeview(tree_frame, columns=cols, show='headings', height=15)

        for col, text, w in [('id', 'ID', 50), ('pair', '貨幣對', 80), ('dir', '方向', 60), ('conf', '信心度', 70),
                              ('entry', '入場價', 80), ('sl', '止損', 80), ('tp', '止盈', 80), ('time', '時間', 130)]:
            tree.heading(col, text=text)
            tree.column(col, width=w)

        for s in signals:
            d = "🟢買" if s.get('direction') == 'buy' else "🔴賣"
            c = s.get('confidence', 0)
            conf = f"{float(c)*100:.0f}%" if c else 'N/A'
            t = str(s.get('createdAt', ''))[:19].replace('T', ' ')
            tree.insert('', 'end', values=(s.get('id'), s.get('pair'), d, conf,
                        s.get('entryPrice', 'N/A'), s.get('stopLoss', 'N/A'), s.get('takeProfit', 'N/A'), t))

        scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

    def render_ml(self, models_data, status_data):
        self.clear_content()

        ttk.Label(self.content, text="ML 模型", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 狀態
        sd = status_data.get('data') or {}
        status = sd.get('status', 'unknown')
        icon = "✅ 運行中" if status == 'running' else "❌ 未連接"

        ttk.Label(self.content, text=f"ML Engine 狀態: {icon}").pack(anchor='w', pady=(0, 15))

        # 模型列表
        ttk.Label(self.content, text="模型列表", style='Header.TLabel').pack(anchor='w', pady=(0, 10))

        md = models_data.get('data') or {}
        models = md.get('models') or []

        tree_frame = ttk.Frame(self.content)
        tree_frame.pack(fill='both', expand=True)

        cols = ('name', 'type', 'ver', 'acc', 'status')
        tree = ttk.Treeview(tree_frame, columns=cols, show='headings', height=10)

        for col, text, w in [('name', '名稱', 150), ('type', '類型', 100), ('ver', '版本', 80), ('acc', '準確率', 80), ('status', '狀態', 80)]:
            tree.heading(col, text=text)
            tree.column(col, width=w)

        for m in models:
            a = m.get('accuracy', 0)
            acc = f"{float(a)*100:.1f}%" if a else 'N/A'
            s = "✅" if m.get('status') == 'active' else "⏸"
            tree.insert('', 'end', values=(m.get('name'), m.get('type'), m.get('version'), acc, s))

        tree.pack(fill='both', expand=True)

    def logout(self):
        if messagebox.askyesno("確認", "確定登出?"):
            self.token = None
            self.show_login()


def main():
    root = tk.Tk()
    app = AIFXAdmin(root)
    root.mainloop()


if __name__ == "__main__":
    main()
