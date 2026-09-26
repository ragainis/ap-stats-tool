/* PC Setup content: diagram layout, boot stages, parts, troubleshooting and compatibility data.
   Timings and behaviour describe a typical modern desktop (ATX power supply, UEFI firmware);
   exact details vary by motherboard vendor, so the manual always wins. */
window.PC = (() => {

/* ---------- diagram (SVG units, viewBox 0 0 900 500) ---------- */
const COMPS = {
  wall:     { x: 20,  y: 222, w: 90,  h: 52, label: 'Wall' },
  psu:      { x: 20,  y: 330, w: 180, h: 140, label: 'Power supply', fan: true },
  button:   { x: 770, y: 428, w: 110, h: 44, label: 'Power button' },
  monitor:  { x: 760, y: 26,  w: 122, h: 86, label: 'Monitor', screen: true },
  keyboard: { x: 760, y: 300, w: 122, h: 40, label: 'Keyboard' },
  eps:      { x: 252, y: 38,  w: 92,  h: 24, label: '8-pin CPU', small: true },
  vrm:      { x: 368, y: 38,  w: 180, h: 34, label: 'VRM' },
  cpufan:   { x: 556, y: 38,  w: 76,  h: 24, label: 'CPU_FAN', small: true, fan: true },
  cpu:      { x: 410, y: 92,  w: 120, h: 120, label: 'CPU' },
  ram:      { x: 575, y: 80,  w: 112, h: 170, label: 'RAM', slots: true },
  atx24:    { x: 700, y: 110, w: 24,  h: 140, label: '24' },
  gpu:      { x: 258, y: 236, w: 304, h: 56, label: 'Graphics card', fan: true },
  m2:       { x: 258, y: 306, w: 176, h: 30, label: 'M.2 SSD' },
  pch:      { x: 462, y: 316, w: 98,  h: 64, label: 'Chipset' },
  ec:       { x: 584, y: 326, w: 64,  h: 34, label: 'EC' },
  bios:     { x: 584, y: 390, w: 66,  h: 30, label: 'BIOS chip' },
  cmos:     { cx: 500, cy: 432, r: 22, label: 'CMOS' },
  leds:     { x: 640, y: 262, w: 84,  h: 50, label: 'Debug LEDs', leds: true, small: true },
  fpanel:   { x: 650, y: 440, w: 72,  h: 22, label: 'F_PANEL', small: true },
};
const BOARD = { x: 240, y: 18, w: 492, h: 464 };

// kind -> colour class (ac, sb = 5V standby, on = PS_ON#, ok = PWR_OK, 12, rails, data, video)
const WIRES = {
  ac:     { k: 'ac',    d: 'M65 274 V330' },
  sb:     { k: 'sb',    d: 'M200 350 H226 V476 H706 V250' },
  pson:   { k: 'on',    d: 'M712 250 V470 H232 V372 H200' },
  pwrok:  { k: 'ok',    d: 'M718 250 V464 H238 V392 H200' },
  rails:  { k: 'rails', d: 'M200 356 H222 V480 H700 V250' },
  eps12:  { k: '12',    d: 'M150 330 V26 H289 V38' },
  gpupwr: { k: '12',    d: 'M180 330 V264 H258' },
  btn:    { k: 'on',    d: 'M770 451 H722' },
  fpec:   { k: 'on',    d: 'M690 440 V343 H648' },
  ecpch:  { k: 'data',  d: 'M584 343 H560' },
  epsvrm: { k: '12',    d: 'M344 50 H368' },
  vrmcpu: { k: 'rails', d: 'M470 72 V92' },
  mem:    { k: 'data',  d: 'M530 150 H575' },
  pcie16: { k: 'data',  d: 'M470 212 V236' },
  pcie4:  { k: 'data',  d: 'M410 200 H248 V321 H258' },
  dmi:    { k: 'data',  d: 'M511 212 V316' },
  spi:    { k: 'data',  d: 'M560 370 H572 V405 H584' },
  video:  { k: 'video', d: 'M562 264 H742 V69 H760' },
  usb:    { k: 'data',  d: 'M760 320 H740 V372 H560' },
};

/* ---------- boot stages ---------- */
const STAGES = [
  {
    id: 'standby', short: 'Plug in', time: 'before you press anything',
    title: 'Plugged in: standby power',
    on: ['wall', 'psu', 'ec', 'atx24'], wires: ['ac', 'sb'],
    what: 'The PC looks off, but it isn\'t completely. As soon as the PSU is plugged in and its rear switch is on (I), it produces one small always-on supply: +5 V standby (5VSB). This keeps a tiny controller on the motherboard awake so it can notice when you press the power button.',
    inputs: ['AC mains from the wall (230 V or 120 V, alternating current)', 'PSU rear switch set to I (on)'],
    outputs: ['+5 V standby on the purple wire (pin 9 of the 24-pin)', 'The embedded controller (EC / Super I/O) starts watching the power button'],
    success: 'On many boards a small LED lights up. Fans stay still.',
    fail: { comps: ['psu'], wires: ['sb'], symptom: 'No standby light on the board, nothing at all when you press power.', causes: ['PSU rear switch at O', 'Power cable not pushed in fully, or a dead outlet or power strip', 'PSU failed'] },
    deep: 'This is why you always unplug the PC before touching the inside. Even when it is "off", part of the board is powered.',
  },
  {
    id: 'button', short: 'Button', time: 't = 0 s',
    title: 'Power button pressed',
    on: ['button', 'fpanel', 'ec', 'atx24', 'psu'], wires: ['btn', 'fpec', 'pson', 'sb'],
    what: 'The case power button is just a switch. Pressing it briefly connects the two PWR_SW pins on the front-panel header. The embedded controller sees that pulse and answers by pulling the green PS_ON# wire to 0 V. That is the "turn on!" command to the power supply.',
    inputs: ['A short press connecting the two PWR_SW pins', '5 V standby keeping the controller awake'],
    outputs: ['PS_ON# (green wire, pin 16) pulled low, telling the PSU to start'],
    success: 'You hear the PSU click or hum within a fraction of a second.',
    fail: { comps: ['fpanel'], wires: ['btn'], symptom: 'Press the button, nothing happens (but the standby LED is on).', causes: ['Front-panel wires on the wrong pins: check the header diagram in the manual', 'Case button cable unplugged', '24-pin not fully latched into the motherboard'] },
    deep: 'Test trick: gently touch the two PWR_SW pins together with a metal screwdriver tip. If the PC starts, the problem is the case button or its cable, not the board. These pins carry only a tiny signal. For PWR_SW, it doesn\'t matter which way round the plug goes. For the LED plugs, it does (+ and −).',
  },
  {
    id: 'rails', short: 'Rails', time: 't ≈ 0.1–0.5 s',
    title: 'PSU starts the main power rails',
    on: ['psu', 'atx24', 'eps', 'gpu', 'cpufan'], wires: ['rails', 'eps12', 'gpupwr', 'pwrok'], fans: ['psu', 'cpufan', 'gpu'],
    what: 'The PSU switches on its main outputs: +12 V (yellow wires, the big one, used by the CPU and GPU), +5 V (red) and +3.3 V (orange). It waits until they are steady, then raises PWR_OK (the grey "power good" wire). That is the green light for the motherboard.',
    inputs: ['PS_ON# held low'],
    outputs: ['+12 V, +5 V, +3.3 V rails', 'PWR_OK (grey wire, pin 8) goes high 0.1–0.5 s after the rails are stable', 'Fans start spinning'],
    success: 'Fans spin and keep spinning.',
    fail: { comps: ['psu'], wires: ['rails'], symptom: 'Fans twitch for a moment and stop, or nothing spins at all.', causes: ['Short circuit, so the PSU\'s protection shuts it down: an extra standoff under the board, or a loose screw behind it', 'Damaged cable or a pinched wire', '24-pin not fully clicked in', 'Faulty PSU'] },
    deep: 'Why 12 V in the cables? Power = voltage × current. For the same power, a higher voltage needs less current, so thinner wires stay cool. The parts that need low voltage make it themselves, right next to where it\'s used.',
  },
  {
    id: 'vrm', short: 'CPU power', time: 't ≈ 0.5 s',
    title: 'VRM powers up the CPU',
    on: ['eps', 'vrm', 'cpu'], wires: ['eps12', 'epsvrm', 'vrmcpu'], fans: ['psu', 'cpufan', 'gpu'],
    what: 'The CPU can\'t use 12 V. It needs around 1 V, but at up to 100+ amps. The VRM (voltage regulator module, the row of chokes and chips around the socket) converts 12 V from the 8-pin CPU cable down to exactly the voltage the CPU asks for, switching hundreds of thousands of times per second.',
    inputs: ['+12 V from the 8-pin EPS (CPU) cable', 'The voltage the CPU requests (it tells the VRM digitally)'],
    outputs: ['Vcore ≈ 0.8–1.4 V, adjusted thousands of times per second as the load changes'],
    success: 'The CPU debug LED turns off after a moment.',
    fail: { comps: ['eps', 'cpu'], wires: ['eps12'], symptom: 'CPU debug LED stays on, no picture.', causes: ['8-pin CPU (EPS) cable not plugged in, or a PCIe cable used by mistake (they look similar but are wired differently, so never force one)', 'CPU not seated properly, or bent socket pins', 'Cooler screwed down unevenly or too tight'] },
    deep: 'A VRM is a "buck converter": transistors switch the 12 V on and off very fast, and an inductor (choke) plus capacitors smooth it into a low, steady voltage. The more phases (sets of these), the smoother and cooler it runs.',
  },
  {
    id: 'firmware', short: 'Firmware', time: 't ≈ 0.5–1 s',
    title: 'Security check and the very first instruction',
    on: ['pch', 'cpu', 'bios'], wires: ['dmi', 'spi', 'vrmcpu'], fans: ['psu', 'cpufan', 'gpu'],
    what: 'With PWR_OK up, the chipset lets the CPU out of RESET. First, a tiny security processor (Intel Management Engine in the chipset, or AMD\'s Platform Security Processor inside the CPU) checks that the firmware is genuine. Then the main CPU core fetches its very first instruction from a fixed address, FFFFFFF0 (hex), which is wired to the BIOS flash chip. The firmware (UEFI) is now running.',
    inputs: ['PWR_OK high, reset released', 'Firmware code in the SPI flash chip (typically 32 MB)'],
    outputs: ['CPU executes firmware; microcode updates loaded into the CPU', 'Settings read from NVRAM (in the flash chip)'],
    success: 'Stays quiet here; progress shows as POST codes on boards that have a code display.',
    fail: { comps: ['bios', 'cpu'], wires: ['spi'], symptom: 'Stuck on the CPU LED or a POST code early on, or a boot loop, with a CPU that is newer than the board.', causes: ['BIOS too old to know this CPU. Update it with BIOS Flashback (works without a CPU)', 'Corrupted BIOS update', 'Settings need a reset: clear CMOS'] },
    deep: 'UEFI boots in phases: SEC (security), PEI (pre-memory: runs using the CPU cache as temporary RAM), DXE (drivers), BDS (boot device selection). "POST" (Power-On Self-Test) is the older name for the whole check.',
  },
  {
    id: 'memory', short: 'RAM', time: 't ≈ 1–10 s (first boot: up to minutes)',
    title: 'Memory training',
    on: ['cpu', 'ram', 'leds'], wires: ['mem'], fans: ['psu', 'cpufan', 'gpu'], led: 'DRAM',
    what: 'The memory controller lives inside the CPU. It reads a small SPD chip on each RAM stick (size, speed, timings, and the XMP/EXPO profile), then "trains" every data line, adjusting timing delays in trillionths of a second until reads and writes are reliable. Until this finishes, nothing can use RAM.',
    inputs: ['SPD data from each stick', 'Your memory settings (default, or XMP/EXPO)'],
    outputs: ['A tested map of usable memory', 'DRAM LED turns off'],
    success: 'DRAM LED goes out. With new RAM or after a CMOS reset, the screen can stay black for a minute or more (DDR5 especially). That is normal, so wait.',
    fail: { comps: ['ram'], wires: ['mem'], symptom: 'DRAM debug LED stays on; maybe beeps; no picture.', causes: ['Stick not fully clicked in (both ends latched, press firmly)', 'Wrong slots: with two sticks, usually A2 and B2 (check the manual)', 'XMP/EXPO speed too high for this CPU or board: clear CMOS and try defaults', 'Mixed kits, or a faulty stick: test one stick at a time'] },
    deep: 'DDR5 runs at 4800–8000+ MT/s: billions of transfers per second on 64 data wires. At those speeds, a few millimetres of extra wire length matter, and that is exactly what training measures.',
  },
  {
    id: 'devices', short: 'Devices', time: 't ≈ 5–15 s',
    title: 'Finding devices: GPU, storage, USB',
    on: ['pch', 'gpu', 'm2', 'keyboard', 'cpu', 'monitor', 'leds'], wires: ['pcie16', 'pcie4', 'dmi', 'usb', 'video', 'ecpch'], fans: ['psu', 'cpufan', 'gpu'], screen: true, led: 'VGA',
    what: 'The firmware walks through every PCIe link and asks "who\'s there?" Each link trains up to its fastest speed (Gen 3/4/5). The graphics card\'s own firmware starts its display output, and the first picture appears. USB devices (keyboard) and drives (NVMe, SATA) are found and listed.',
    inputs: ['Devices answering on PCIe, USB, SATA', 'GPU with its own power cables connected'],
    outputs: ['First picture on the monitor (logo)', 'List of drives and devices', 'VGA LED turns off'],
    success: 'Logo appears; keyboard lights up.',
    fail: { comps: ['gpu', 'monitor'], wires: ['video', 'gpupwr'], symptom: 'Fans spin, VGA LED on or no picture.', causes: ['Monitor cable plugged into the motherboard instead of the graphics card', 'GPU power cables missing or loose (use separate cables, and push 12V-2x6 plugs fully in)', 'GPU not fully seated, latch not clicked', 'CPU without built-in graphics (Intel "F", AMD "F", Ryzen 1000–5000 without "G") and no GPU', 'Monitor on the wrong input'] },
    deep: 'PCIe is lanes of fast serial links. Each generation doubles the speed per lane: Gen 3 ≈ 1 GB/s, Gen 4 ≈ 2 GB/s, Gen 5 ≈ 4 GB/s. A graphics card uses 16 lanes; an NVMe SSD uses 4.',
  },
  {
    id: 'bootmgr', short: 'Boot', time: 't ≈ 10–20 s',
    title: 'Setup screen and boot manager',
    on: ['bios', 'm2', 'monitor', 'keyboard', 'cmos', 'leds'], wires: ['pcie4', 'video', 'usb', 'spi'], fans: ['psu', 'cpufan', 'gpu'], screen: true, led: 'BOOT',
    what: 'This is the moment to press DEL or F2 to enter BIOS setup. Otherwise the boot manager follows the boot order, looks for an EFI system partition on a drive, checks the boot loader\'s signature (Secure Boot) and starts it. The CMOS coin battery keeps the clock running while the PC is unplugged.',
    inputs: ['Boot order setting', 'A drive with an EFI system partition (FAT32), e.g. \\EFI\\Microsoft\\Boot\\bootmgfw.efi'],
    outputs: ['Control handed to the operating system\'s boot loader', 'BOOT LED turns off'],
    success: 'The Windows logo or spinning dots appear.',
    fail: { comps: ['m2'], wires: ['pcie4'], symptom: '"No bootable device" / "Reboot and select proper boot device", or the BOOT LED stays on.', causes: ['No operating system installed yet: boot from a USB installer', 'SSD not seated or screwed down in the M.2 slot', 'Wrong boot order', 'Some M.2 slots share lanes with SATA ports and disable them (check the manual)'] },
    deep: 'Settings live in NVRAM inside the flash chip. The CMOS battery (a CR2032) mainly keeps the real-time clock ticking. "Clear CMOS" resets settings to defaults, the cure for a bad overclock or memory setting.',
  },
  {
    id: 'os', short: 'Windows', time: 't ≈ 20–40 s',
    title: 'Operating system takes over',
    on: ['cpu', 'ram', 'm2', 'gpu', 'monitor', 'keyboard'], wires: ['pcie4', 'mem', 'pcie16', 'video', 'usb'], fans: ['psu', 'cpufan', 'gpu'], screen: true,
    what: 'The boot loader copies the Windows kernel from the SSD into RAM, the firmware steps aside ("ExitBootServices"), and the OS loads its own drivers for every device, from graphics to network to audio. From here on, Windows is in charge.',
    inputs: ['Kernel and drivers read from the SSD'],
    outputs: ['Desktop / login screen'],
    success: 'You can log in. Done!',
    fail: { comps: ['ram', 'cpu'], wires: ['mem'], symptom: 'Blue screen, freezes or restart loops.', causes: ['Unstable memory profile (XMP/EXPO): test with defaults, run MemTest86', 'Overheating: cooler film left on, pump not connected, no thermal paste', 'Missing drivers: install chipset and GPU drivers', 'Windows 11 install blocked: enable TPM (fTPM on AMD / PTT on Intel) and Secure Boot'] },
    deep: 'From power button to desktop, the CPU has gone from one instruction at a fixed address to running billions per second across many cores, and every step depended on the one before.',
  },
];

/* ---------- parts ---------- */
const PARTS = {
  psu: { name: 'Power supply (PSU)', what: 'Turns AC from the wall into the steady DC voltages the PC uses: +12 V, +5 V, +3.3 V and +5 V standby.', nums: ['Wattage rating, e.g. 750 W', '80 PLUS rating = efficiency (Gold ≈ 90% at half load)', 'ATX 3.x units have the 12V-2x6 GPU plug'], mistakes: ['Rear switch left at O', 'Using cables from a different PSU brand/model: pinouts differ and can destroy parts. Never mix modular cables!'], io: 'In: AC mains, PS_ON#. Out: power rails, PWR_OK.' },
  atx24: { name: '24-pin ATX power', what: 'The main power cable to the motherboard. Carries the rails plus the three control wires: 5VSB (purple), PS_ON# (green) and PWR_OK (grey).', nums: ['Pin 8 PWR_OK · pin 9 +5VSB · pin 16 PS_ON#'], mistakes: ['Not fully latched: it\'s stiff, so push until the clip clicks'], io: 'Carries power in; PS_ON# goes back out to the PSU.' },
  eps: { name: '8-pin CPU (EPS 12V)', what: 'Dedicated 12 V feed for the CPU\'s VRM. Often labelled CPU and split 4+4. Some boards have a second one (optional for most CPUs).', nums: ['Up to ~300+ W per 8-pin'], mistakes: ['Forgotten entirely (very common!), so the CPU LED stays on', 'Using a PCIe 6+2 cable instead: similar shape, different wiring'], io: 'In: +12 V from PSU. Out: to the VRM.' },
  vrm: { name: 'VRM', what: 'Voltage regulator module: converts 12 V into the ~1 V the CPU needs, at very high current. The heatsinks around the socket cool it.', nums: ['Up to 100–250 A for the CPU', 'Switches ~300,000–1,000,000 times per second'], mistakes: ['Blocking airflow over VRM heatsinks in small cases'], io: 'In: 12 V + the voltage the CPU requests. Out: Vcore.' },
  cpu: { name: 'CPU (processor)', what: 'Runs every instruction. Also contains the memory controller (it talks to RAM directly) and, on many models, built-in graphics.', nums: ['Clock: 3–6 GHz = 3–6 billion ticks per second', 'Cores: 6–24 on typical desktops', 'Socket: AM4, AM5, LGA1700, LGA1851…'], mistakes: ['Wrong socket/chipset for the board', 'Bent pins (on the board for LGA, on the CPU for AM4)', 'Cooler film left on / no thermal paste'], io: 'In: Vcore, clock, firmware. Out: talks to RAM, GPU, chipset.' },
  cpufan: { name: 'CPU_FAN header', what: 'Fan/pump connector the board watches for the CPU cooler. Many boards refuse to boot or warn "CPU fan error" if nothing spins here.', nums: ['4-pin PWM: 12 V, ground, speed sense, PWM control'], mistakes: ['Cooler fan plugged into a case fan header, or AIO pump plugged into nothing'], io: 'Out: power + speed control. In: fan speed (RPM) signal.' },
  ram: { name: 'RAM (memory)', what: 'Fast temporary workspace. Everything running is loaded into RAM. It forgets when power goes off.', nums: ['DDR4 or DDR5, never both on one board', 'Speed in MT/s, e.g. DDR5-6000', 'Use slots A2 + B2 for two sticks (usually)'], mistakes: ['Not pushed in until both latches click', 'Using slots A1 + A2 (both in the same channel, so half speed)', 'Expecting XMP/EXPO speed without enabling it in BIOS'], io: 'In/out: data on the memory bus from the CPU. SPD chip tells its specs.' },
  gpu: { name: 'Graphics card (GPU)', what: 'Draws everything you see. Has its own processor, memory (VRAM) and firmware.', nums: ['PCIe x16 slot', '75 W from the slot; the rest via 8-pin or 12V-2x6 cables', 'Typical gaming cards: 150–450 W'], mistakes: ['Monitor plugged into the motherboard instead of the GPU', 'Power cables missing or daisy-chained on a big card', 'Slot latch not clicked'], io: 'In: PCIe data + 12 V. Out: video to the monitor.' },
  m2: { name: 'M.2 NVMe SSD', what: 'Fast storage on a stick-shaped board: holds Windows, games and files, and keeps them without power.', nums: ['PCIe x4: Gen4 ≈ 7 GB/s, Gen5 ≈ 12+ GB/s', 'Held by one small screw or a tool-less clip'], mistakes: ['Not screwed down, so it lifts out of the slot', 'Protective film left on the M.2 heatsink pad', 'Using a slot that disables SATA ports'], io: 'In/out: data over PCIe.' },
  pch: { name: 'Chipset (PCH)', what: 'A traffic hub: connects USB, SATA, extra M.2 slots, network and audio to the CPU through one fast link (DMI on Intel).', nums: ['Named by model: B650, X870, Z790, B860…'], mistakes: ['Assuming every chipset supports overclocking (Intel: only Z-series for CPU OC)'], io: 'In/out: DMI to CPU; USB, SATA, PCIe to devices.' },
  ec: { name: 'EC / Super I/O', what: 'A small always-on controller. Watches the power button, controls PS_ON#, reads fan speeds and temperatures.', nums: ['Runs on 5 V standby'], mistakes: [], io: 'In: power button, sensors. Out: PS_ON#, fan control.' },
  bios: { name: 'BIOS flash chip', what: 'Holds the firmware (UEFI): the first code the CPU runs. Also stores your BIOS settings (NVRAM).', nums: ['SPI flash, typically 32 MB', 'Updated via BIOS menu, or BIOS Flashback without a CPU'], mistakes: ['Turning off during a BIOS update', 'Old BIOS that doesn\'t know a newer CPU'], io: 'Out: firmware code to the CPU over SPI.' },
  cmos: { name: 'CMOS battery', what: 'A CR2032 coin cell that keeps the real-time clock running when unplugged. "Clear CMOS" resets BIOS settings to defaults.', nums: ['3 V, lasts years'], mistakes: ['Clock resets every time you unplug, so the battery is flat'], io: 'Out: 3 V to the clock circuit.' },
  leds: { name: 'Debug LEDs (EZ Debug / Q-LED)', what: 'Four lights (CPU, DRAM, VGA, BOOT) that show which stage of startup is running. The one that stays lit is where it got stuck. Some boards show two-digit POST codes instead.', nums: ['Order: CPU → DRAM → VGA → BOOT'], mistakes: ['Ignoring them: they\'re the fastest clue you have'], io: 'Out: status lights.' },
  fpanel: { name: 'Front-panel header (F_PANEL)', what: 'Small pins for the case buttons and lights: power switch, reset switch, power LED, HDD LED.', nums: ['PWR_SW: polarity doesn\'t matter', 'LEDs: + and − matter'], mistakes: ['Off by one pin: follow the diagram printed on the board or in the manual'], io: 'In: button presses. Out: LED power.' },
  button: { name: 'Case power button', what: 'A momentary switch wired to PWR_SW. It doesn\'t carry power itself; it just sends a signal.', nums: [], mistakes: ['Case cable not plugged in to the header'], io: 'Out: a short "pressed" signal.' },
  monitor: { name: 'Monitor', what: 'Shows the picture. Receives digital video over HDMI or DisplayPort.', nums: ['DisplayPort usually supports the highest refresh rates'], mistakes: ['Wrong input selected', 'Cable in the motherboard\'s video port while using a GPU'], io: 'In: video signal.' },
  keyboard: { name: 'USB keyboard', what: 'Found during device detection. Needed to enter BIOS setup (DEL/F2).', nums: [], mistakes: ['Some wireless keyboards don\'t work in BIOS: keep a wired one handy'], io: 'Out: key presses over USB.' },
  wall: { name: 'Wall outlet', what: 'Alternating current (AC) mains, which flips direction 50 or 60 times per second.', nums: ['230 V 50 Hz (Europe) / 120 V 60 Hz (North America)'], mistakes: ['A power strip switched off'], io: 'Out: AC power.' },
};

/* ---------- troubleshooter ---------- */
const SYMPTOMS = [
  { id: 'dead', ic: '⚫', t: 'Nothing happens at all', s: 'No fans, no lights',
    steps: [
      ['PSU rear switch on (I) and the power cable firmly in', 'The simplest thing first. Also try a different outlet.'],
      ['Is there a standby light on the motherboard?', 'If yes, the PSU\'s 5 V standby works and the problem is the button path. If no, suspect the PSU or the 24-pin.'],
      ['24-pin fully clicked into the board', 'It\'s stiff. A half-inserted 24-pin is a classic cause.'],
      ['Front-panel PWR_SW wires on the right pins', 'Follow the F_PANEL diagram in the manual. One pin off is enough to fail.'],
      ['Short the PWR_SW pins with a screwdriver tip', 'If the PC starts, the case button or its cable is the problem.'],
      ['Test the PSU', 'With a PSU tester, or a different known-good PSU. Never use modular cables from another PSU.'],
    ] },
  { id: 'twitch', ic: '🌀', t: 'Fans twitch, then stop', s: 'Spins for a second and dies',
    steps: [
      ['Unplug and check for short circuits', 'The PSU shut itself off to protect the parts. That usually means a short.'],
      ['Standoffs match the motherboard holes, with no extras', 'An extra standoff touching the back of the board is a classic short.'],
      ['No loose screws behind the board or under the GPU', 'Shake the case gently and listen.'],
      ['Build it "outside the case"', 'Board on its box with only CPU, 1 RAM stick, cooler and PSU. If it works there, something in the case is shorting.'],
      ['Check GPU and CPU power cables', 'A damaged cable or a pin pushed out of its plug can short.'],
    ] },
  { id: 'nodisplay', ic: '🖥️', t: 'Fans spin, but no picture', s: 'The most common one',
    steps: [
      ['Monitor cable in the graphics card, not the motherboard', 'The motherboard\'s video ports only work with a CPU that has built-in graphics.'],
      ['Check which debug LED is lit', 'Use the LED picker on the left. It tells you which stage failed.'],
      ['Wait 2–3 minutes', 'First boot with new RAM trains memory, especially DDR5, and the screen stays black meanwhile.'],
      ['RAM firmly seated, in the right slots', 'Push until both ends click. Two sticks usually go in A2 + B2.'],
      ['GPU seated and powered', 'Latch clicked; every GPU power socket filled; use separate cables where possible.'],
      ['Monitor input source correct', 'Use the monitor\'s buttons to pick HDMI/DP.'],
      ['Clear CMOS', 'Resets settings like a too-fast memory profile.'],
      ['BIOS version supports the CPU?', 'A new CPU on an older board may need a BIOS update. Use BIOS Flashback.'],
    ] },
  { id: 'loop', ic: '🔁', t: 'Keeps restarting before the logo', s: 'Boot loop, power cycling',
    steps: [
      ['Wait: it may be memory training', 'Boards often restart 2–3 times during first training. Give it a few minutes.'],
      ['Clear CMOS', 'Removes unstable memory or overclock settings.'],
      ['Try one RAM stick', 'In slot A2 (check the manual), then swap sticks to find a bad one.'],
      ['Check the BIOS supports your CPU', 'Unsupported CPUs often loop. Update with BIOS Flashback.'],
      ['Check the 8-pin CPU cable', 'Loose CPU power can cause resets under load.'],
    ] },
  { id: 'nobootdev', ic: '💾', t: '"No bootable device"', s: 'BIOS works, Windows doesn\'t start',
    steps: [
      ['Is Windows installed yet?', 'A brand-new SSD is empty. Boot from a Windows USB installer (made with Microsoft\'s Media Creation Tool).'],
      ['Does BIOS list the SSD?', 'If not: reseat the M.2 stick and screw it down; check SATA data + power cables.'],
      ['Boot order', 'Put "Windows Boot Manager" (or the USB installer) first.'],
      ['M.2 / SATA lane sharing', 'Some M.2 slots disable certain SATA ports. The manual has a table.'],
    ] },
  { id: 'hot', ic: '🔥', t: 'Shuts off or slows down under load', s: 'Gaming crashes, sudden power-off',
    steps: [
      ['Plastic film removed from the cooler base', 'Very common on first builds!'],
      ['Thermal paste applied, cooler mounted evenly', 'A pea-sized dot in the centre is plenty.'],
      ['AIO pump plugged in (CPU_FAN / AIO_PUMP header)', 'A pump that isn\'t running makes the CPU overheat within seconds.'],
      ['Check temperatures in BIOS or HWiNFO', 'CPU at idle ~30–50 °C is normal; 95 °C+ under light load is not.'],
      ['PSU wattage enough?', 'Use the calculator in Compatibility. Power spikes from a big GPU can trip a weak PSU.'],
    ] },
  { id: 'ramspeed', ic: '🐢', t: 'RAM slower than on the box', s: 'Shows 4800 instead of 6000',
    steps: [
      ['Enable XMP (Intel) or EXPO (AMD) in BIOS', 'RAM always starts at a safe default speed. The rated speed is an overclock profile.'],
      ['Check the sticks are in A2 + B2', 'A1 + A2 puts both in one channel.'],
      ['If unstable: step down one speed notch', 'Not every CPU memory controller hits every speed.'],
    ] },
  { id: 'usb', ic: '🔌', t: 'Front USB / audio not working', s: 'Case ports dead',
    steps: [
      ['Front USB and HD_AUDIO cables plugged into the board', 'Separate small plugs from the case: USB 3 (blue, 19-pin), USB-C (small key), HD_AUDIO.'],
      ['Right header for each', 'The USB 2 header looks similar to others: follow the manual.'],
      ['Install chipset/audio drivers', 'From the motherboard maker\'s support page.'],
    ] },
];
const LEDS = {
  CPU: { what: 'Stuck before or during CPU start.', steps: ['8-pin CPU (EPS) cable plugged in, with the CPU cable, not PCIe', 'CPU seated, lever/latch closed; check for bent pins', 'Cooler tightened evenly (too tight can cause contact problems)', 'BIOS supports this CPU: update with BIOS Flashback'] },
  DRAM: { what: 'Memory didn\'t initialise.', steps: ['Wait a few minutes on the first boot (training)', 'Reseat RAM: press until both latches click', 'Use the manual\'s recommended slots (usually A2 + B2)', 'Clear CMOS (resets XMP/EXPO)', 'Test one stick at a time'] },
  VGA: { what: 'No usable graphics found.', steps: ['Reseat the GPU, latch clicked', 'All GPU power cables connected and fully pushed in', 'Monitor on the GPU\'s port', 'If the CPU has built-in graphics: remove the GPU and test the motherboard output'] },
  BOOT: { what: 'No bootable drive found.', steps: ['Install Windows from a USB installer', 'Check the SSD is detected in BIOS', 'Fix boot order', 'Reseat the M.2 drive'] },
};

/* ---------- compatibility ---------- */
const SOCKETS = {
  AM4: { cpus: 'AMD Ryzen 1000–5000', ram: 'DDR4 only', chipsets: 'A320, B350, B450, X470, B550, X570', bios: 'Ryzen 5000 on 300/400-series boards needs a recent BIOS; many boards dropped older CPUs to fit new ones.', igpu: 'Only "G" models (e.g. 5600G) have graphics.', cooler: 'AM4 mounting (backplate)' },
  AM5: { cpus: 'AMD Ryzen 7000, 8000, 9000', ram: 'DDR5 only', chipsets: 'A620, B650, B650E, X670, X670E, B850, X870, X870E', bios: 'Ryzen 9000 on 600-series boards needs a BIOS update. Most AM5 boards have BIOS Flashback.', igpu: 'Most models have basic graphics, except "F" models (e.g. 7500F).', cooler: 'Same holes as AM4, so most AM4 coolers fit' },
  LGA1700: { cpus: 'Intel Core 12th, 13th, 14th gen', ram: 'DDR4 or DDR5: the board decides (never both)', chipsets: 'H610, B660, B760, H670, Z690, Z790', bios: '13th/14th gen on 600-series boards needs a BIOS update. Keep BIOS current on 13th/14th gen for stability fixes.', igpu: '"F" models (e.g. 13400F) have no graphics.', cooler: 'LGA1700 bracket (not LGA1200)' },
  LGA1851: { cpus: 'Intel Core Ultra 200S (e.g. 245K, 265K, 285K)', ram: 'DDR5 only', chipsets: 'B860, H810, Z890', bios: 'Early boards benefit from updates for performance fixes.', igpu: '"F" models have no graphics.', cooler: 'Same holes as LGA1700, so LGA1700 coolers fit' },
};
const FIT = [
  ['Motherboard size fits the case', 'ATX > Micro-ATX > Mini-ITX. The case lists which it supports.'],
  ['GPU length fits', 'Compare the card length (mm) with the case\'s max GPU length, and account for front radiators or fans.'],
  ['CPU cooler height fits', 'Air coolers: compare height with the case\'s CPU cooler clearance.'],
  ['Radiator fits (if AIO)', 'Check the case supports 240/280/360 mm in the spot you want.'],
  ['PSU has the right GPU connectors', 'Newer cards: 12V-2x6 (ATX 3.x PSUs have it natively); others: 2–3 × 8-pin PCIe.'],
  ['RAM fits under the cooler', 'Tall RAM can hit big air coolers.'],
  ['Enough M.2 slots / SATA ports', 'And check which ones share lanes.'],
];

/* ---------- learn ---------- */
const GLOSSARY = [
  ['BIOS / UEFI', 'Firmware that starts the PC. UEFI is the modern version; people still say BIOS.'],
  ['POST', 'Power-On Self-Test: the checks the firmware runs before booting.'],
  ['Firmware', 'Software stored on a chip inside a device, below the operating system.'],
  ['VRM', 'Voltage regulator module: makes the CPU\'s low voltage from 12 V.'],
  ['PCIe lane', 'One fast two-way serial link. x16 = 16 lanes side by side.'],
  ['XMP / EXPO', 'Saved memory overclock profiles (Intel / AMD) that you enable in BIOS.'],
  ['Chipset', 'Hub chip connecting USB, SATA and extra devices to the CPU.'],
  ['TDP', 'Rough heat output the cooler must handle, in watts.'],
  ['Clear CMOS', 'Reset BIOS settings to defaults.'],
  ['BIOS Flashback', 'Update the BIOS from a USB stick without a CPU or RAM installed.'],
  ['Thermal paste', 'Fills microscopic gaps between CPU and cooler so heat can flow.'],
  ['ESD', 'Electrostatic discharge: a static shock that can damage chips.'],
];

return { COMPS, BOARD, WIRES, STAGES, PARTS, SYMPTOMS, LEDS, SOCKETS, FIT, GLOSSARY };
})();
