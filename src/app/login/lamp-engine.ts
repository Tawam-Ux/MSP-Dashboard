// โคมไฟตั้งโต๊ะหน้า Login
// 1) วางผังโคมตามตำแหน่งการ์ดและขอบโต๊ะ: ฐานบนโต๊ะซ้ายการ์ด → แขนล่าง → ข้อศอก → แขนบน → หัวโคมเหนือมุมซ้ายบนของการ์ด
// 2) ฟิสิกส์: ลูกปัดแขวนสาย ลากได้รอบทิศ 360° (เข้าใกล้จุดผูก = สายหย่อน · เลยความยาวสาย = ยืดแบบยาง)
//    ปล่อยแล้วแกว่งแบบลูกตุ้ม (เหวี่ยงแรงหมุนรอบจุดผูกได้) · หัวโคมผงกตามแรงดึงแล้วเด้งกลับตามสปริงของแขน
// เขียนตำแหน่งลง DOM ตรงทุกเฟรม (ไม่ผ่าน React state) และหยุด loop เองเมื่อทุกอย่างนิ่ง

export type Via = "mouse" | "pen" | "touch" | "keyboard";

/** ความยาวสายดึงตอนนิ่ง (px) */
const CORD_LEN = 52;
/** สายยืดเกินความยาวได้ไกลสุด (ยืดแบบยาง ยิ่งดึงยิ่งหนืด) */
const PULL_MAX = 110;
/** สายยืดเกินความยาวถึงระยะนี้ (ดึงทิศไหนก็ได้) = สวิตช์ดังกริ๊กและไฟเปลี่ยนทันทีระหว่างดึง ไม่ต้องรอปล่อย */
const PULL_CLICK = 38;
/** แตะ / Enter / Space = ดึงลงให้อัตโนมัติถึงระยะนี้ใน 0.14 วินาที */
const AUTO_PULL = 52;
/** สายยืดลงแนวดิ่ง 1px หัวโคมผงกลง (องศา) — ดึงเฉียงผงกตามส่วนที่ลงแนวดิ่ง · ดึงขึ้นหัวเงยเล็กน้อย */
const DEG_PER_PX = 0.045;
/**
 * สาย (k = ความแข็ง, c = หน่วง): ดึงกลับเฉพาะตอนตึงเกินความยาว (หย่อนได้) · หน่วงพอให้ดีดกลับแล้วลูกปัดเด้งขึ้นนิดเดียว
 * หัวโคมเด้งบนสปริงของแขน
 */
const CORD = { k: 900, c: 42 };
const HEAD = { k: 46, c: 3.4 };
/** แรงโน้มถ่วงของลูกปัด (px/s²): กับสายยาว CORD_LEN แกว่งแบบลูกตุ้มราว 1.2 รอบต่อวินาที */
const GRAVITY = 3120;
/** แรงต้านอากาศ (หน่วงการแกว่ง ลูกปัดแกว่งสองสามรอบแล้วนิ่ง) */
const AIR = 3.6;
/** ความเร็วสูงสุดตอนปล่อยมือ (px/s): เหวี่ยงแรงลูกปัดหมุนรอบจุดผูกได้ แต่ไม่ปลิวไกล */
const FLING_MAX = 1600;
/** หัวโคมชี้ลงขวาไปทางการ์ด (องศาจากแนวนอน) */
const HEAD_ANGLE = 50;
/** พิกัดบนหัวโคมก่อนหมุน (จุดหมุน = ข้อต่อท้ายหัวโคม): จุดผูกสายดึงใต้คอโคม · กลางปากโคม (หลอดไฟ/จุดเริ่มลำแสง) */
const CORD_AT = { x: 6, y: 14 };
const MOUTH_X = 88;
/** ขอบเขตหัวโคมรอบจุดหมุนเมื่อหมุน HEAD_ANGLE (หน่วยก่อนย่อขยาย): ต่ำสุด = ขอบล่างของปากโคม · สูงสุด = มุมขั้วหลอด */
const HEAD_BELOW = 98;
const HEAD_ABOVE = 20;
/** หัวโคมลอยเหนือการ์ดทั้งหัว: จุดต่ำสุดห่างขอบบนการ์ด 8px (เผื่อหัวผงก) — โคมไม่ทับการ์ด */
const HEAD_GAP = 8;
/** ขนาดโคมสูงสุด (จอกว้าง / จอแคบกว่า 640px) — ย่อลงอัตโนมัติเมื่อที่ว่างเหนือการ์ดไม่พอ */
const MAX_SCALE = { wide: 1.3, narrow: 1 };
/** ครึ่งความกว้างฐานโคม (หน่วยก่อนย่อขยาย = viewBox ของ LampBase ใน lamp-login.tsx) */
const BASE_HALF = 70;

type Parts = {
  room: HTMLElement;
  /** กรอบการ์ด (วัดตำแหน่ง — การ์ดตั้งอยู่บนโต๊ะ) */
  card: HTMLElement;
  desk: HTMLElement;
  /** ชั้นที่หมุนตามหัวโคม: ตัวหัวโคม · ลำแสง */
  head: HTMLElement;
  beam: HTMLElement;
  base: HTMLElement;
  lowerArm: HTMLElement;
  upperArm: HTMLElement;
  /** ข้อต่อ: ฐาน · ข้อศอก · คอหัวโคม */
  joints: HTMLElement[];
  cord: SVGPathElement;
  bead: HTMLButtonElement;
  beadBody: HTMLElement;
  /** ไส้หลอดเรืองแดงหลังปิดไฟ (อยู่เหนือความมืด ตามตำแหน่งหลอด) */
  ember: HTMLElement;
  /** ความมืดของห้อง (ทึบเมื่อปิดไฟ) */
  night: HTMLElement;
};
type Point = { x: number; y: number };
/** การลาก: จุดเริ่มของนิ้ว/เมาส์ (x0, y0) · ตำแหน่งลูกปัดตอนจับ (bx0, by0) · สวิตช์ดังไปแล้วหรือยัง (crossed) */
type Drag = { id: number; x0: number; y0: number; bx0: number; by0: number; moved: number; crossed: boolean; via: Via; t: number };

const viaOf = (type: string): Via => (type === "touch" || type === "pen" ? type : "mouse");
const px = (n: number) => n.toFixed(2);

export class LampEngine {
  /** ลูกปัดเทียบกับจุดผูกสาย (px) และความเร็ว (px/s): นิ่ง = ห้อยตรงลงพอดีความยาวสาย */
  private bx = 0;
  private by = CORD_LEN;
  private vx = 0;
  private vy = 0;
  /** หัวโคมผงก (องศา เพิ่มจาก HEAD_ANGLE) */
  private th = 0;
  private vth = 0;
  /** จุดหมุนหัวโคม (พิกัดในห้อง) และขนาดหัวโคม (จอแคบย่อลง) — ได้จาก layout() */
  private pivot: Point = { x: 0, y: 0 };
  private scale = 1;
  private drag: Drag | null = null;
  private auto: { t0: number; via: Via; bx0: number; by0: number } | null = null;
  private raf = 0;
  private last = 0;
  private lit = false;
  private nudgeDir = 1;
  private readonly timers: number[] = [];
  private readonly observer: ResizeObserver;
  private readonly reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private readonly parts: Parts,
    private readonly onSwitch: (lit: boolean, via: Via) => void,
  ) {
    const { bead } = parts;
    bead.addEventListener("pointerdown", this.down);
    bead.addEventListener("pointermove", this.move);
    bead.addEventListener("pointerup", this.up);
    bead.addEventListener("pointercancel", this.cancel);
    bead.addEventListener("click", this.click);
    window.addEventListener("keydown", this.key);
    // ผังโคมตามการ์ดและโต๊ะ: วางใหม่เมื่อขนาดจอ/การ์ดเปลี่ยน และเมื่อฟอนต์โหลดเสร็จ (การ์ดสูงขึ้น)
    this.observer = new ResizeObserver(() => this.layout());
    this.observer.observe(parts.room);
    this.observer.observe(parts.card);
    this.layout();
    void document.fonts?.ready.then(() => this.layout());
    // เปิดหน้า: หัวโคมเพิ่งถูกจัดท่า เด้งเบาๆ แล้วนิ่ง · ห้องมืดอยู่นาน ลูกปัดไหวเหมือนมีลมเป็นระยะ
    if (!this.reduce.matches) {
      this.th = 2;
      this.wake();
    }
    this.timers.push(window.setInterval(this.nudge, 5200));
  }

  destroy() {
    const { bead } = this.parts;
    bead.removeEventListener("pointerdown", this.down);
    bead.removeEventListener("pointermove", this.move);
    bead.removeEventListener("pointerup", this.up);
    bead.removeEventListener("pointercancel", this.cancel);
    bead.removeEventListener("click", this.click);
    window.removeEventListener("keydown", this.key);
    this.observer.disconnect();
    for (const t of this.timers) window.clearInterval(t);
    cancelAnimationFrame(this.raf);
  }

  /** ล็อกอินไม่ผ่าน: ไฟตกวูบหนึ่งครั้ง (แสงหรี่ ห้องมืดลงชั่วครู่) */
  dip() {
    if (!this.lit || this.reduce.matches) return;
    const timing = { duration: 560, easing: "linear" };
    for (const el of this.parts.room.querySelectorAll("[data-lit]")) {
      el.animate([{ opacity: 1 }, { opacity: 0.28, offset: 0.18 }, { opacity: 0.95, offset: 0.34 }, { opacity: 0.5, offset: 0.5 }, { opacity: 1 }], timing);
    }
    this.parts.night.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.18 }, { opacity: 0.04, offset: 0.34 }, { opacity: 0.32, offset: 0.5 }, { opacity: 0 }], timing);
  }

  // ---------- ผังโคม ----------

  /**
   * วางชิ้นส่วนโคมจากตำแหน่งการ์ดและขอบบนของโต๊ะ (offsetLeft/Top = ตำแหน่งตามผัง ไม่รวม transform ตอนการ์ดซ่อน)
   * หัวโคมลอยเหนือมุมซ้ายบนของการ์ด ไม่ทับการ์ด · ขนาดโคมตามที่ว่างเหนือการ์ด (เว้นขอบบนจอ 12px)
   * ข้อศอกอยู่บนเส้นตั้งฉากกับแนวฐาน→หัวโคม ไปทางซ้าย (ห่างจากการ์ด) ให้แขนสองท่อนยาวเท่ากัน
   */
  private layout = () => {
    const { room, card, desk, base, lowerArm, upperArm, joints } = this.parts;
    const deskTop = desk.offsetTop;
    const narrow = room.clientWidth < 640;
    const s = Math.max(0.6, Math.min(narrow ? MAX_SCALE.narrow : MAX_SCALE.wide, (card.offsetTop - 12 - HEAD_GAP) / (HEAD_BELOW + HEAD_ABOVE)));
    this.scale = s;
    room.style.setProperty("--lamp-s", s.toFixed(3));
    // จอกว้าง: หัวโคมเยื้องซ้ายของขอบการ์ด ลูกปัดห้อยนอกการ์ด (ดึงลงก็ไม่ผ่านหน้าการ์ด)
    // จอแคบ: ไม่มีที่ซ้ายการ์ด หัวโคมอยู่เหนือมุมการ์ดแทน · ฐานโคมเลยขอบซ้ายไปทั้งก้อน (เห็นแค่แขนบนยื่นเข้ามา)
    const head = { x: card.offsetLeft + (narrow ? 16 : -12), y: card.offsetTop - HEAD_GAP - HEAD_BELOW * s };
    // ฐานชิดการ์ดพอประมาณ + ข้อศอกงอไม่มาก: โคมตั้งกระชับข้างการ์ด
    const foot = { x: card.offsetLeft - (narrow ? 110 : 100 * s + 10), y: deskTop + 4 };
    const dx = head.x - foot.x;
    const dy = head.y - foot.y;
    const d = Math.hypot(dx, dy) || 1;
    const arm = d * 0.54;
    const bend = Math.sqrt(Math.max(0, arm * arm - (d / 2) ** 2));
    const elbow = { x: foot.x + dx / 2 + (dy / d) * bend, y: foot.y + dy / 2 - (dx / d) * bend };

    const rod = (el: HTMLElement, a: Point, b: Point) => {
      el.style.width = `${px(Math.hypot(b.x - a.x, b.y - a.y))}px`;
      el.style.transform = `translate(${px(a.x)}px, ${px(a.y)}px) rotate(${px((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI)}deg)`;
    };
    rod(lowerArm, foot, elbow);
    rod(upperArm, elbow, head);
    [foot, elbow, head].forEach((p, i) => (joints[i].style.transform = `translate(${px(p.x)}px, ${px(p.y)}px)`));
    base.style.transform = `translate(${px(foot.x)}px, ${px(deskTop)}px) scale(${s.toFixed(3)})`;

    this.pivot = head;
    // จุดศูนย์กลางแสงบนผนังและวงแสงบนโต๊ะ (ให้ CSS ใช้)
    const rad = (HEAD_ANGLE * Math.PI) / 180;
    room.style.setProperty("--glow-x", `${px(head.x + MOUTH_X * this.scale * Math.cos(rad))}px`);
    room.style.setProperty("--glow-y", `${px(head.y + MOUTH_X * this.scale * Math.sin(rad))}px`);
    room.style.setProperty("--pool-x", `${px(card.offsetLeft + card.offsetWidth * 0.3)}px`);
    // ให้ของบนผนังและบนโต๊ะรู้ตำแหน่ง: ขอบซ้าย/ขวา/บนของการ์ด · ขอบบนโต๊ะ · ขอบซ้ายฐานโคม
    // กระดานชอล์กฝั่งซ้ายกว้างได้ถึงก่อนการ์ด (แขนโคมพาดหน้ากระดาน) · กระดานกับชั้นหนังสือสูงได้ไม่เกินขอบโต๊ะ
    // ของบนโต๊ะวางขวาการ์ดและซ้ายฐานโคม
    room.style.setProperty("--card-left", `${px(card.offsetLeft)}px`);
    room.style.setProperty("--card-right", `${px(card.offsetLeft + card.offsetWidth)}px`);
    room.style.setProperty("--card-top", `${px(card.offsetTop)}px`);
    room.style.setProperty("--desk-top", `${px(deskTop)}px`);
    room.style.setProperty("--base-left", `${px(foot.x - BASE_HALF * s)}px`);
    this.render();
    room.dataset.ready = "";
  };

  // ---------- การดึงสาย ----------

  private down = (e: PointerEvent) => {
    if (e.button !== 0 || this.auto) return;
    this.parts.bead.setPointerCapture(e.pointerId);
    this.parts.bead.dataset.dragging = "";
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, bx0: this.bx, by0: this.by, moved: 0, crossed: false, via: viaOf(e.pointerType), t: e.timeStamp };
    this.wake();
  };

  private move = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    // ลูกปัดตามนิ้ว/เมาส์ได้รอบทิศ: ใกล้จุดผูกกว่าความยาวสาย = สายหย่อน · เลยความยาวสาย = ยืดแบบยาง (ยิ่งดึงยิ่งหนืด)
    let x = d.bx0 + dx;
    let y = d.by0 + dy;
    const r = Math.hypot(x, y);
    if (r > CORD_LEN) {
      const k = (CORD_LEN + PULL_MAX * (1 - Math.exp(-(r - CORD_LEN) / PULL_MAX))) / r;
      x *= k;
      y *= k;
    }
    // ความเร็วจากการลาก (เฉลี่ยเรียบ) — ปล่อยมือแล้วลูกปัดพุ่งต่อจากความเร็วนี้
    const dt = Math.max(0.008, (e.timeStamp - d.t) / 1000);
    this.vx = 0.6 * this.vx + (0.4 * (x - this.bx)) / dt;
    this.vy = 0.6 * this.vy + (0.4 * (y - this.by)) / dt;
    this.bx = x;
    this.by = y;
    d.t = e.timeStamp;
    if (!d.crossed && this.stretch() >= PULL_CLICK) {
      d.crossed = true;
      this.flip(d.via);
    }
    this.wake();
  };

  /** สายยืดเกินความยาวปกติ (px) ไม่ว่าดึงไปทิศไหน · ติดลบ = สายหย่อน */
  private stretch() {
    return Math.hypot(this.bx, this.by) - CORD_LEN;
  }

  private up = (e: PointerEvent) => {
    const d = this.release(e);
    // แตะเฉยๆ (ไม่ได้ลาก) = ดึงให้อัตโนมัติ
    if (d && d.moved < 6) this.pull(d.via);
  };

  private cancel = (e: PointerEvent) => {
    this.release(e);
  };

  private release(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return null;
    this.drag = null;
    delete this.parts.bead.dataset.dragging;
    // ปล่อยมือ: ถือนิ่งก่อนปล่อย = ไม่มีแรงเหวี่ยง · เหวี่ยงแรงเกินเพดานให้ลดลงมาที่เพดาน
    if (e.timeStamp - d.t > 90) this.vx = this.vy = 0;
    const v = Math.hypot(this.vx, this.vy);
    if (v > FLING_MAX) {
      this.vx *= FLING_MAX / v;
      this.vy *= FLING_MAX / v;
    }
    this.wake();
    return d;
  }

  /** Enter/Space บนสายดึง (click ที่ไม่ได้มาจากเมาส์ — เมาส์จัดการใน pointer events แล้ว) */
  private click = (e: MouseEvent) => {
    if (e.detail === 0) this.pull("keyboard");
  };

  /** ไฟปิดอยู่: Enter / Space / Tab ที่ไหนก็ได้ = ดึงสายเปิดไฟ แล้วไปที่ฟอร์ม */
  private key = (e: KeyboardEvent) => {
    if (this.lit || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const onBead = e.target === this.parts.bead;
    const go = (e.key === "Tab" && !e.shiftKey) || (!onBead && (e.key === "Enter" || e.key === " "));
    if (!go) return;
    e.preventDefault();
    this.pull("keyboard");
  };

  private pull(via: Via) {
    if (this.auto || this.drag) return;
    if (this.reduce.matches) return this.flip(via);
    this.auto = { t0: performance.now(), via, bx0: this.bx, by0: this.by };
    this.wake();
  }

  private flip(via: Via) {
    this.lit = !this.lit;
    if (via === "touch") navigator.vibrate?.(12);
    this.parts.beadBody.animate([{ scale: "1" }, { scale: "1.16" }, { scale: "1" }], { duration: 220, easing: "ease-out" });
    this.onSwitch(this.lit, via);
  }

  /** ห้องมืดและไม่มีใครแตะ: ลูกปัดไหวเบาๆ ชวนให้ดึง */
  private nudge = () => {
    if (this.lit || this.drag || this.auto || this.raf || document.hidden || this.reduce.matches) return;
    this.vx += 38 * this.nudgeDir;
    this.nudgeDir = -this.nudgeDir;
    this.wake();
  };

  // ---------- loop ----------

  private wake() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    let dt = Math.min(0.064, (now - this.last) / 1000);
    this.last = now;
    const a = this.auto;
    if (a) {
      // ดึงอัตโนมัติ: พาลูกปัดจากที่อยู่ตอนนี้ลงไปใต้จุดผูกจนสายยืด AUTO_PULL แล้วสวิตช์ดัง ปล่อยให้ดีดกลับเอง
      const k = Math.min(1, (now - a.t0) / 140);
      const e = 1 - (1 - k) ** 3;
      this.bx = a.bx0 * (1 - e);
      this.by = a.by0 + (CORD_LEN + AUTO_PULL - a.by0) * e;
      this.vx = this.vy = 0;
      if (k >= 1) {
        this.auto = null;
        this.flip(a.via);
      }
    }
    const held = this.drag !== null || this.auto !== null;
    const still = this.reduce.matches;
    // ระหว่างดึง หัวโคมผงกตามแรงดึงส่วนที่ลงแนวดิ่ง (ตามหลังเล็กน้อย) · ปล่อยแล้วเด้งกลับบนสปริง
    const r = Math.hypot(this.bx, this.by) || 1;
    const target = held ? Math.max(0, r - CORD_LEN) * (this.by / r) * DEG_PER_PX : 0;
    // แบ่งก้าวย่อย 1/240 วินาที ให้สปริงแข็งยังเสถียร
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      dt -= h;
      if (!held) this.swing(h);
      if (still) {
        this.th = 0;
        this.vth = 0;
      } else {
        this.vth += (-HEAD.k * (this.th - target) - HEAD.c * this.vth) * h;
        this.th += this.vth * h;
      }
    }
    const resting =
      !held &&
      Math.abs(this.bx) < 0.05 && Math.abs(this.by - CORD_LEN) < 0.05 &&
      Math.abs(this.vx) < 0.5 && Math.abs(this.vy) < 0.5 &&
      Math.abs(this.th) < 0.002 && Math.abs(this.vth) < 0.01;
    if (resting) {
      this.bx = this.vx = this.vy = this.th = this.vth = 0;
      this.by = CORD_LEN;
      this.render();
      this.raf = 0;
      return;
    }
    this.render();
    this.raf = requestAnimationFrame(this.tick);
  };

  /**
   * ลูกปัดแขวนสาย หนึ่งก้าวย่อย (h วินาที): แรงโน้มถ่วง + แรงต้านอากาศ
   * สายดึงกลับ (สปริง + หน่วงตามแนวสาย) เฉพาะตอนลูกปัดอยู่ไกลกว่าความยาวธรรมชาติของสาย — ใกล้กว่านั้นสายหย่อน ลูกปัดลอยอิสระ
   * ความยาวธรรมชาติสั้นกว่า CORD_LEN เท่าที่น้ำหนักลูกปัดถ่วงให้ยืด: ห้อยนิ่งพอดี CORD_LEN
   * ลดการเคลื่อนไหว: แรงต้านอากาศมากขึ้น ลูกปัดกลับที่เดิมโดยไม่แกว่งไปมา
   */
  private swing(h: number) {
    const air = this.reduce.matches ? AIR * 4 : AIR;
    let ax = -air * this.vx;
    let ay = GRAVITY - air * this.vy;
    const r = Math.hypot(this.bx, this.by);
    const over = r - (CORD_LEN - GRAVITY / CORD.k);
    if (over > 0 && r > 0) {
      const ux = this.bx / r;
      const uy = this.by / r;
      const f = CORD.k * over + CORD.c * (this.vx * ux + this.vy * uy);
      ax -= f * ux;
      ay -= f * uy;
    }
    this.vx += ax * h;
    this.vy += ay * h;
    this.bx += this.vx * h;
    this.by += this.vy * h;
  }

  private render() {
    const { head, beam, cord, bead, ember, room } = this.parts;
    const p = this.pivot;
    const angle = HEAD_ANGLE + this.th;
    const pose = `translate(${px(p.x)}px, ${px(p.y)}px) rotate(${px(angle)}deg) scale(${this.scale})`;
    head.style.transform = pose;
    beam.style.transform = pose;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad) * this.scale;
    const sin = Math.sin(rad) * this.scale;
    // จุดผูกสายเคลื่อนตามหัวโคม · สายห้อยลงตามแรงโน้มถ่วง (ไม่หมุนตามหัวโคม)
    const ax = p.x + CORD_AT.x * cos - CORD_AT.y * sin;
    const ay = p.y + CORD_AT.x * sin + CORD_AT.y * cos;
    // ลูกปัดอยู่ได้รอบจุดผูก · สายตึง = เกือบตรง โค้งตามแรงเหวี่ยงเล็กน้อย (ปลายสายนำ กลางสายตามหลัง)
    // สายหย่อน = ตกท้องช้างลงตามแรงโน้มถ่วง (ยิ่งลูกปัดเข้าใกล้จุดผูก สายยิ่งห้อยลึก สูงสุดครึ่งความยาวสาย)
    const bx = ax + this.bx;
    const by = ay + this.by;
    const r = Math.hypot(this.bx, this.by) || 1;
    const nx = -this.by / r;
    const ny = this.bx / r;
    const bend = Math.max(-14, Math.min(14, -(this.vx * nx + this.vy * ny) * 0.02));
    const slack = Math.max(0, CORD_LEN - r);
    const sag = Math.min(CORD_LEN / 2, Math.max(Math.sqrt((3 * r * slack) / 8), slack / 2));
    const cx = ax + this.bx / 2 + nx * bend;
    const cy = ay + this.by / 2 + ny * bend + sag * 2;
    cord.setAttribute("d", `M${px(ax)} ${px(ay)}Q${px(cx)} ${px(cy)} ${px(bx)} ${px(by)}`);
    // ลูกปัดชี้ตามปลายสายตอนสายตึง · สายหย่อนมากขึ้นลูกปัดค่อยๆ ห้อยลงตามน้ำหนักตัวเอง
    const taut = Math.min(1, Math.max(0, (r - CORD_LEN * 0.85) / (CORD_LEN * 0.15)));
    const tilt = (Math.atan2(bx - cx, by - cy) * 180) / Math.PI;
    bead.style.transform = `translate(${px(bx - 22)}px, ${px(by)}px) rotate(${px(-tilt * taut)}deg)`;
    ember.style.transform = `translate(${px(p.x + MOUTH_X * cos)}px, ${px(p.y + MOUTH_X * sin)}px)`;
    // มุมผงกให้ CSS ใช้ขยับแสงบนการ์ดและเงาการ์ดตาม
    room.style.setProperty("--sway", this.th.toFixed(3));
  }
}
