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
import json
from datetime import datetime, timezone, timedelta

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
        self.url_var = tk.StringVar(value="https://instrumental-recipe-deployment-app.trycloudflare.com")
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
            ("📰 情緒", lambda: self.show_view('sentiment')),
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
            elif view == 'sentiment':
                self.root.after(0, self.render_sentiment)

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

        for name, label in [('postgres', 'PostgreSQL'), ('redis', 'Redis'), ('mlEngine', 'ML Engine'), ('sentiment', '情緒分析')]:
            s = services.get(name, 'unknown')
            icon = "✅" if s == 'connected' else "❌" if s == 'disconnected' else "⚠️"
            row = ttk.Frame(svc_frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=15).pack(side='left')
            ttk.Label(row, text=f"{icon} {s}").pack(side='left')

            # 情緒分析額外資訊
            if name == 'sentiment' and s == 'connected':
                sinfo = hd.get('sentimentInfo', {})
                if sinfo:
                    ttk.Label(row, text=f"  (Model: {sinfo.get('model', 'N/A')}, Source: {sinfo.get('newsSource', 'N/A')})",
                             foreground='gray').pack(side='left')

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

        ttk.Label(self.content, text="訊號管理", style='Title.TLabel').pack(anchor='w', pady=(0, 15))

        # 篩選器
        filter_frame = ttk.LabelFrame(self.content, text="篩選條件", padding=10)
        filter_frame.pack(fill='x', pady=(0, 15))

        # 貨幣對篩選
        ttk.Label(filter_frame, text="貨幣對:").grid(row=0, column=0, padx=5, pady=5, sticky='e')
        self.pair_filter = ttk.Combobox(filter_frame, values=['全部', 'EUR/USD', 'GBP/USD', 'USD/JPY'], width=12, state='readonly')
        self.pair_filter.set('全部')
        self.pair_filter.grid(row=0, column=1, padx=5, pady=5)

        # 時間週期篩選
        ttk.Label(filter_frame, text="週期:").grid(row=0, column=2, padx=5, pady=5, sticky='e')
        self.tf_filter = ttk.Combobox(filter_frame, values=['全部', '15min', '1h', '4h', '1d'], width=10, state='readonly')
        self.tf_filter.set('全部')
        self.tf_filter.grid(row=0, column=3, padx=5, pady=5)

        # 方向篩選
        ttk.Label(filter_frame, text="方向:").grid(row=0, column=4, padx=5, pady=5, sticky='e')
        self.dir_filter = ttk.Combobox(filter_frame, values=['全部', 'buy', 'sell', 'hold'], width=10, state='readonly')
        self.dir_filter.set('全部')
        self.dir_filter.grid(row=0, column=5, padx=5, pady=5)

        # 篩選按鈕
        ttk.Button(filter_frame, text="🔍 篩選", command=self.apply_signal_filter).grid(row=0, column=6, padx=15, pady=5)
        ttk.Button(filter_frame, text="🔄 重置", command=self.reset_signal_filter).grid(row=0, column=7, padx=5, pady=5)

        # 顯示資料
        self.display_signals(data)

    def apply_signal_filter(self):
        """套用篩選條件"""
        params = {'limit': 100}

        pair = self.pair_filter.get()
        if pair and pair != '全部':
            params['pair'] = pair

        tf = self.tf_filter.get()
        if tf and tf != '全部':
            params['timeframe'] = tf

        direction = self.dir_filter.get()
        if direction and direction != '全部':
            params['direction'] = direction

        def load():
            data = self.api('GET', '/admin/signals', params=params)
            self.root.after(0, lambda: self.display_signals(data))

        threading.Thread(target=load, daemon=True).start()

    def reset_signal_filter(self):
        """重置篩選"""
        self.pair_filter.set('全部')
        self.tf_filter.set('全部')
        self.dir_filter.set('全部')
        self.apply_signal_filter()

    def display_signals(self, data):
        """顯示訊號表格"""
        # 清除舊的表格 (保留篩選器)
        for widget in self.content.winfo_children():
            if isinstance(widget, ttk.LabelFrame):
                continue
            if hasattr(widget, 'winfo_name') and 'label' in str(type(widget)).lower():
                if widget.cget('text') == '訊號管理':
                    continue
            widget.destroy()

        if not data.get('success'):
            ttk.Label(self.content, text=f"錯誤: {data.get('error')}", style='Error.TLabel').pack()
            return

        result = data.get('data') or {}
        signals = result.get('signals') or []

        # 統計摘要
        summary_frame = ttk.Frame(self.content)
        summary_frame.pack(fill='x', pady=(0, 10))

        total = result.get('total', 0)
        buy_count = sum(1 for s in signals if s.get('direction') == 'buy')
        sell_count = sum(1 for s in signals if s.get('direction') == 'sell')
        hold_count = sum(1 for s in signals if s.get('direction') not in ['buy', 'sell'])

        ttk.Label(summary_frame, text=f"共 {total} 個訊號  |  ").pack(side='left')
        ttk.Label(summary_frame, text=f"🟢 買入: {buy_count}  ", foreground='green').pack(side='left')
        ttk.Label(summary_frame, text=f"🔴 賣出: {sell_count}  ", foreground='red').pack(side='left')
        ttk.Label(summary_frame, text=f"⚪ 觀望: {hold_count}", foreground='gray').pack(side='left')

        # 表格
        tree_frame = ttk.Frame(self.content)
        tree_frame.pack(fill='both', expand=True)

        cols = ('pair', 'tf', 'dir', 'conf', 'sentiment', 'technical', 'strength', 'entry', 'time')
        tree = ttk.Treeview(tree_frame, columns=cols, show='headings', height=15)

        headers = [
            ('pair', '貨幣對', 75),
            ('tf', '週期', 55),
            ('dir', '方向', 70),
            ('conf', '信心度', 60),
            ('sentiment', '情緒', 55),
            ('technical', '技術', 55),
            ('strength', '強度', 60),
            ('entry', '入場價', 85),
            ('time', '建立時間 (GMT+8)', 140)
        ]

        for col, text, w in headers:
            tree.heading(col, text=text)
            tree.column(col, width=w, anchor='center')

        # 時間週期對照
        tf_map = {'15min': '15分', '30min': '30分', '1h': '1時', '1hour': '1時', '4h': '4時', '1d': '日線', '1w': '週線'}

        for s in signals:
            # 方向顯示
            direction = s.get('direction', '')
            if direction == 'buy':
                dir_text = "🟢 買入"
            elif direction == 'sell':
                dir_text = "🔴 賣出"
            else:
                dir_text = "⚪ 觀望"

            # 信心度
            c = s.get('confidence', 0)
            conf = f"{float(c)*100:.0f}%" if c else '-'

            # 時間週期
            tf = s.get('timeframe', '')
            tf_display = tf_map.get(tf, tf) if tf else '-'

            # 訊號強度
            strength = s.get('signalStrength', '')
            strength_map = {'very_strong': '極強', 'strong': '強', 'moderate': '中等', 'weak': '弱'}
            strength_text = strength_map.get(strength, strength) if strength else '-'

            # 情緒和技術分數 (從 factors 取得)
            factors = s.get('factors') or {}
            if isinstance(factors, str):
                try:
                    factors = json.loads(factors)
                except:
                    factors = {}
            sentiment_score = factors.get('sentiment', 0)
            technical_score = factors.get('technical', 0)
            sentiment_text = f"{float(sentiment_score)*100:.0f}%" if sentiment_score else '-'
            technical_text = f"{float(technical_score)*100:.0f}%" if technical_score else '-'

            # 價格格式化
            entry = s.get('entryPrice')
            entry_text = f"{float(entry):.5f}" if entry else '-'

            # 時間 (轉換為 GMT+8)
            ts = str(s.get('createdAt', ''))
            try:
                ts_clean = ts.replace('Z', '+00:00')
                dt_utc = datetime.fromisoformat(ts_clean)
                gmt8 = timezone(timedelta(hours=8))
                dt_gmt8 = dt_utc.astimezone(gmt8)
                time_text = dt_gmt8.strftime('%Y-%m-%d %H:%M')
            except:
                time_text = ts[:16].replace('T', ' ')

            tree.insert('', 'end', values=(
                s.get('pair', ''),
                tf_display,
                dir_text,
                conf,
                sentiment_text,
                technical_text,
                strength_text,
                entry_text,
                time_text
            ))

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

    def render_sentiment(self):
        """顯示情緒分析測試介面"""
        self.clear_content()

        ttk.Label(self.content, text="情緒分析測試", style='Title.TLabel').pack(anchor='w', pady=(0, 20))

        # 測試區域
        test_frame = ttk.LabelFrame(self.content, text="測試情緒分析", padding=15)
        test_frame.pack(fill='x', pady=(0, 15))

        # 貨幣對選擇
        row1 = ttk.Frame(test_frame)
        row1.pack(fill='x', pady=5)

        ttk.Label(row1, text="貨幣對:").pack(side='left', padx=(0, 10))
        self.sentiment_pair = ttk.Combobox(row1, values=['EUR/USD', 'USD/JPY', 'GBP/USD', 'AUD/USD', 'USD/CHF', 'USD/CAD'], width=12, state='readonly')
        self.sentiment_pair.set('EUR/USD')
        self.sentiment_pair.pack(side='left', padx=(0, 20))

        ttk.Label(row1, text="時間週期:").pack(side='left', padx=(0, 10))
        self.sentiment_tf = ttk.Combobox(row1, values=['15min', '1h', '4h', '1d', '1w'], width=10, state='readonly')
        self.sentiment_tf.set('1h')
        self.sentiment_tf.pack(side='left', padx=(0, 20))

        ttk.Button(row1, text="🔍 分析", command=self.do_sentiment_test).pack(side='left', padx=10)

        # 結果區域
        self.sentiment_result_frame = ttk.LabelFrame(self.content, text="分析結果", padding=15)
        self.sentiment_result_frame.pack(fill='both', expand=True)

        ttk.Label(self.sentiment_result_frame, text="選擇貨幣對並點擊「分析」按鈕", foreground='gray').pack(pady=30)

        # 說明
        info_frame = ttk.LabelFrame(self.content, text="情緒分析說明", padding=10)
        info_frame.pack(fill='x', pady=(15, 0))

        info_text = """
• 新聞情緒 (News): 從 Google News RSS 獲取財經新聞，使用 FinBERT 模型分析
• 央行情緒 (Central Bank): 分析各國央行政策相關新聞
• 綜合情緒分數: 0.0 (極度看空) ~ 0.5 (中性) ~ 1.0 (極度看多)
• 信心度: 表示分析結果的可信程度
• 時間週期越長，情緒權重越高 (15min: 5%, 1h: 15%, 4h: 30%, 1d: 45%, 1w: 60%)
• 快取時間: 1 小時
        """
        ttk.Label(info_frame, text=info_text.strip(), justify='left').pack(anchor='w')

    def do_sentiment_test(self):
        """執行情緒分析測試"""
        pair = self.sentiment_pair.get().replace('/', '')
        tf = self.sentiment_tf.get()

        # 清除舊結果
        for w in self.sentiment_result_frame.winfo_children():
            w.destroy()

        loading = ttk.Label(self.sentiment_result_frame, text="分析中... (可能需要 10-30 秒)")
        loading.pack(pady=30)
        self.root.update()

        def analyze():
            data = self.api('GET', f'/admin/sentiment/test/{pair}', params={'timeframe': tf})
            self.root.after(0, lambda: self.display_sentiment_result(data))

        threading.Thread(target=analyze, daemon=True).start()

    def display_sentiment_result(self, data):
        """顯示情緒分析結果"""
        # 清除載入中
        for w in self.sentiment_result_frame.winfo_children():
            w.destroy()

        if not data.get('success'):
            ttk.Label(self.sentiment_result_frame, text=f"錯誤: {data.get('error', '未知錯誤')}", style='Error.TLabel').pack(pady=30)
            return

        result = data.get('data', {})
        sentiment = result.get('sentiment', {})

        if not sentiment:
            ttk.Label(self.sentiment_result_frame, text="無情緒資料", style='Error.TLabel').pack(pady=30)
            return

        # 標題資訊
        header = ttk.Frame(self.sentiment_result_frame)
        header.pack(fill='x', pady=(0, 15))

        pair_display = result.get('pair', 'N/A')
        tf_display = result.get('timeframe', 'N/A')
        ttk.Label(header, text=f"貨幣對: {pair_display}  |  時間週期: {tf_display}", font=('Arial', 11, 'bold')).pack(side='left')

        # 主要情緒卡片
        cards_frame = ttk.Frame(self.sentiment_result_frame)
        cards_frame.pack(fill='x', pady=10)

        # 綜合情緒
        score = sentiment.get('sentiment_score', 0.5)
        signal = sentiment.get('signal', 'neutral')
        confidence = sentiment.get('confidence', 0)

        # 訊號顏色和文字
        if signal == 'bullish':
            signal_text = "🟢 看多"
            signal_color = 'green'
        elif signal == 'bearish':
            signal_text = "🔴 看空"
            signal_color = 'red'
        else:
            signal_text = "⚪ 中性"
            signal_color = 'gray'

        # 綜合情緒卡片
        main_card = ttk.LabelFrame(cards_frame, text="綜合情緒", padding=15)
        main_card.grid(row=0, column=0, padx=10, pady=5, sticky='nsew')
        cards_frame.columnconfigure(0, weight=1)

        ttk.Label(main_card, text=signal_text, font=('Arial', 18, 'bold'), foreground=signal_color).pack()
        ttk.Label(main_card, text=f"分數: {score:.4f}").pack(pady=(5, 0))
        ttk.Label(main_card, text=f"信心度: {confidence:.2%}").pack()

        # 新聞情緒卡片
        sources = sentiment.get('sources', {})
        news_score = sources.get('news', 0.5)
        cb_score = sources.get('central_bank', 0.5)

        news_card = ttk.LabelFrame(cards_frame, text="新聞情緒", padding=15)
        news_card.grid(row=0, column=1, padx=10, pady=5, sticky='nsew')
        cards_frame.columnconfigure(1, weight=1)

        news_signal = "看多" if news_score > 0.55 else ("看空" if news_score < 0.45 else "中性")
        ttk.Label(news_card, text=f"{news_score:.4f}", font=('Arial', 16, 'bold')).pack()
        ttk.Label(news_card, text=news_signal).pack(pady=(5, 0))

        # 央行情緒卡片
        cb_card = ttk.LabelFrame(cards_frame, text="央行情緒", padding=15)
        cb_card.grid(row=0, column=2, padx=10, pady=5, sticky='nsew')
        cards_frame.columnconfigure(2, weight=1)

        cb_signal = "鷹派" if cb_score > 0.55 else ("鴿派" if cb_score < 0.45 else "中性")
        ttk.Label(cb_card, text=f"{cb_score:.4f}", font=('Arial', 16, 'bold')).pack()
        ttk.Label(cb_card, text=cb_signal).pack(pady=(5, 0))

        # 詳細資訊
        details_frame = ttk.LabelFrame(self.sentiment_result_frame, text="詳細資訊", padding=10)
        details_frame.pack(fill='x', pady=(15, 0))

        details = sentiment.get('details', {})
        weights = sentiment.get('weights', {})

        # 文章數量
        row1 = ttk.Frame(details_frame)
        row1.pack(fill='x', pady=3)
        ttk.Label(row1, text="新聞文章:", width=15).pack(side='left')
        ttk.Label(row1, text=f"{details.get('news_articles_analyzed', 0)} 篇").pack(side='left')

        row2 = ttk.Frame(details_frame)
        row2.pack(fill='x', pady=3)
        ttk.Label(row2, text="央行文章:", width=15).pack(side='left')
        ttk.Label(row2, text=f"{details.get('gov_articles_analyzed', 0)} 篇").pack(side='left')

        # 權重
        row3 = ttk.Frame(details_frame)
        row3.pack(fill='x', pady=3)
        ttk.Label(row3, text="新聞權重:", width=15).pack(side='left')
        ttk.Label(row3, text=f"{weights.get('news', 0):.2%}").pack(side='left')

        row4 = ttk.Frame(details_frame)
        row4.pack(fill='x', pady=3)
        ttk.Label(row4, text="央行權重:", width=15).pack(side='left')
        ttk.Label(row4, text=f"{weights.get('central_bank', 0):.2%}").pack(side='left')

        # 時間戳 (轉換為 GMT+8)
        ts = sentiment.get('timestamp', '')
        if ts:
            row5 = ttk.Frame(details_frame)
            row5.pack(fill='x', pady=3)
            ttk.Label(row5, text="分析時間:", width=15).pack(side='left')
            # 將 UTC 時間轉換為 GMT+8
            try:
                # 解析 ISO 格式時間戳 (例如 "2025-12-02T13:34:39.491128Z")
                ts_clean = ts.replace('Z', '+00:00')
                dt_utc = datetime.fromisoformat(ts_clean)
                # 轉換為 GMT+8
                gmt8 = timezone(timedelta(hours=8))
                dt_gmt8 = dt_utc.astimezone(gmt8)
                ts_display = dt_gmt8.strftime('%Y-%m-%d %H:%M:%S') + ' (GMT+8)'
            except Exception:
                ts_display = ts[:19].replace('T', ' ')
            ttk.Label(row5, text=ts_display).pack(side='left')

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
