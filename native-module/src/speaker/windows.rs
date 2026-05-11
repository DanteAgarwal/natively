// Windows WASAPI loopback capture for system audio
use anyhow::Result;
use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use ringbuf::{HeapRb, traits::{Producer, Consumer, Observer, Split}};
use wasapi::{get_default_device, DeviceCollection, Direction, ShareMode};
use windows::Win32::Media::Audio::{
    IMMDeviceEnumerator, MMDeviceEnumerator, eRender, eCommunications, eMultimedia, ERole,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

struct WakerState {
    shutdown: bool,
}

pub struct SpeakerInput {
    device_id: Option<String>,
}

pub struct SpeakerStream {
    consumer: Option<ringbuf::HeapCons<f32>>,
    waker_state: Arc<Mutex<WakerState>>,
    capture_thread: Option<thread::JoinHandle<()>>,
    actual_sample_rate: u32,
}

impl SpeakerStream {
    pub fn sample_rate(&self) -> u32 {
        self.actual_sample_rate
    }

    pub fn take_consumer(&mut self) -> Option<ringbuf::HeapCons<f32>> {
        self.consumer.take()
    }
}

// Helper to find device by ID
fn find_device_by_id(direction: &Direction, device_id: &str) -> Option<wasapi::Device> {
    let collection = DeviceCollection::new(direction).ok()?;
    let count = collection.get_nbr_devices().ok()?;

    for i in 0..count {
        if let Ok(device) = collection.get_device_at_index(i) {
            if let Ok(id) = device.get_id() {
                if id == device_id {
                    return Some(device);
                }
            }
        }
    }
    None
}

/// Returns the device ID string for the default render device with the given role.
/// Must be called on a COM-initialised thread.
fn get_default_device_id_by_role(role: ERole) -> Option<String> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, role).ok()?;
        let id_ptr = device.GetId().ok()?;
        let id = id_ptr.to_string().ok()?;
        // PWSTR from GetId must be freed with CoTaskMemFree
        CoTaskMemFree(Some(id_ptr.0 as *const std::ffi::c_void));
        Some(id)
    }
}

pub fn list_output_devices() -> Result<Vec<(String, String)>> {
    let collection = DeviceCollection::new(&Direction::Render).map_err(|e| anyhow::anyhow!("{}", e))?;
    let count = collection.get_nbr_devices().map_err(|e| anyhow::anyhow!("{}", e))?;
    let mut list = Vec::new();

    for i in 0..count {
        if let Ok(device) = collection.get_device_at_index(i) {
            let id = device.get_id().unwrap_or_default();
            let name = device.get_friendlyname().unwrap_or_default();
            if !id.is_empty() {
                list.push((id, name));
            }
        }
    }
    Ok(list)
}

impl SpeakerInput {
    pub fn new(device_id: Option<String>) -> Result<Self> {
        let device_id = device_id.filter(|id| !id.is_empty() && id != "default");
        // comm_device_id is only populated for the default-device path; it is
        // resolved lazily inside stream() on the capture thread (COM must be
        // initialised there).
        Ok(Self { device_id })
    }

    pub fn stream(self) -> SpeakerStream {
        // 512K samples — enough headroom for two simultaneous capture paths
        // going through the mixer before reaching the output ring buffer.
        let rb = HeapRb::<f32>::new(524288);
        let (producer, consumer) = rb.split();

        let waker_state = Arc::new(Mutex::new(WakerState {
            shutdown: false,
        }));
        let (init_tx, init_rx) = mpsc::channel();

        let waker_clone = waker_state.clone();
        let device_id = self.device_id;

        let capture_thread = thread::spawn(move || {
            // When a specific device_id is supplied we use the single-device
            // path unchanged.  For the default-device case we discover both
            // roles here (COM is initialised inside each helper before the
            // wasapi calls).
            if device_id.is_some() {
                if let Err(e) = Self::capture_audio_loop(producer, waker_clone, init_tx, device_id) {
                    eprintln!("[WASAPI] Audio capture loop failed: {}", e);
                }
            } else {
                Self::capture_default_devices(producer, waker_clone, init_tx);
            }
        });

        let actual_sample_rate = match init_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(rate)) => rate,
            Ok(Err(e)) => {
                eprintln!("[WASAPI] Audio initialization failed: {}", e);
                44100
            }
            Err(_) => {
                eprintln!("[WASAPI] Audio initialization timeout");
                44100
            }
        };

        SpeakerStream {
            consumer: Some(consumer),
            waker_state,
            capture_thread: Some(capture_thread),
            actual_sample_rate,
        }
    }

    /// Called when no explicit device is requested.  Resolves the multimedia
    /// and communications default render devices.  If they are the same,
    /// falls through to the standard single-device loop.  If different, spawns
    /// two internal capture threads and runs a mixer loop that sums their
    /// samples into the single output producer.
    fn capture_default_devices(
        mut output_producer: ringbuf::HeapProd<f32>,
        waker_state: Arc<Mutex<WakerState>>,
        init_tx: mpsc::Sender<Result<u32>>,
    ) {
        // COM init for this thread (needed for GetDefaultAudioEndpoint).
        unsafe {
            windows::Win32::System::Com::CoInitializeEx(
                None,
                windows::Win32::System::Com::COINIT_MULTITHREADED,
            ).ok();
        }

        let mm_id = get_default_device_id_by_role(eMultimedia);
        let comm_id = get_default_device_id_by_role(eCommunications);

        eprintln!("[WASAPI] Multimedia device id: {:?}", mm_id);
        eprintln!("[WASAPI] Communications device id: {:?}", comm_id);

        let same_device = match (&mm_id, &comm_id) {
            (Some(a), Some(b)) => a == b,
            _ => true, // if either lookup failed, fall back to single path
        };

        if same_device {
            eprintln!("[WASAPI] Multimedia and communications devices are the same — single capture path");
            if let Err(e) = Self::capture_audio_loop(output_producer, waker_state, init_tx, None) {
                eprintln!("[WASAPI] Audio capture loop failed: {}", e);
            }
            return;
        }

        eprintln!("[WASAPI] Different communications device detected — enabling dual capture");

        // Internal ring buffers for the two sub-capture threads.
        // 262144 samples each — plenty before the mixer drains them.
        let rb_mm = HeapRb::<f32>::new(262144);
        let (prod_mm, mut cons_mm) = rb_mm.split();
        let rb_comm = HeapRb::<f32>::new(262144);
        let (prod_comm, mut cons_comm) = rb_comm.split();

        let waker_mm = waker_state.clone();
        let waker_comm = waker_state.clone();

        // init channels — we use the multimedia thread's sample rate as the
        // authoritative value and discard the communications thread's.
        let (init_mm_tx, init_mm_rx) = mpsc::channel::<Result<u32>>();
        let (init_comm_tx, _init_comm_rx) = mpsc::channel::<Result<u32>>();

        let mm_id_clone = mm_id.clone();
        let comm_id_clone = comm_id.clone();

        thread::spawn(move || {
            if let Err(e) = Self::capture_audio_loop(prod_mm, waker_mm, init_mm_tx, mm_id_clone) {
                eprintln!("[WASAPI][MM] Capture loop failed: {}", e);
            }
        });

        thread::spawn(move || {
            if let Err(e) = Self::capture_audio_loop(prod_comm, waker_comm, init_comm_tx, comm_id_clone) {
                eprintln!("[WASAPI][COMM] Capture loop failed: {}", e);
            }
        });

        // Forward the multimedia device's sample rate to the outer caller.
        let sample_rate = match init_mm_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(rate)) => rate,
            Ok(Err(e)) => {
                let _ = init_tx.send(Err(e));
                return;
            }
            Err(_) => {
                let _ = init_tx.send(Err(anyhow::anyhow!("Multimedia capture init timeout")));
                return;
            }
        };
        let _ = init_tx.send(Ok(sample_rate));

        // Mixer loop: drain both consumers, sum matching sample positions, push
        // to the output producer.  We poll at ~1 ms so latency stays low.
        let poll = Duration::from_millis(1);
        loop {
            {
                let state = waker_state.lock().unwrap();
                if state.shutdown {
                    break;
                }
            }

            // Drain all available samples from each sub-buffer this tick.
            let mm_available = cons_mm.occupied_len();
            let comm_available = cons_comm.occupied_len();
            let pairs = mm_available.min(comm_available);

            if pairs > 0 {
                for _ in 0..pairs {
                    let s_mm = cons_mm.try_pop().unwrap_or(0.0_f32);
                    let s_comm = cons_comm.try_pop().unwrap_or(0.0_f32);
                    let mixed = (s_mm + s_comm).clamp(-1.0_f32, 1.0_f32);
                    let _ = output_producer.try_push(mixed);
                }
            } else if mm_available > 0 {
                // Communications buffer has nothing yet — pass multimedia through.
                for _ in 0..mm_available {
                    if let Some(s) = cons_mm.try_pop() {
                        let _ = output_producer.try_push(s.clamp(-1.0_f32, 1.0_f32));
                    }
                }
            } else if comm_available > 0 {
                // Multimedia buffer has nothing — pass communications through.
                for _ in 0..comm_available {
                    if let Some(s) = cons_comm.try_pop() {
                        let _ = output_producer.try_push(s.clamp(-1.0_f32, 1.0_f32));
                    }
                }
            } else {
                thread::sleep(poll);
            }
        }
    }

    fn capture_audio_loop(
        mut producer: ringbuf::HeapProd<f32>,
        waker_state: Arc<Mutex<WakerState>>,
        init_tx: mpsc::Sender<Result<u32>>,
        device_id: Option<String>,
    ) -> Result<()> {
        // Initialize COM for this thread
        unsafe {
            windows::Win32::System::Com::CoInitializeEx(
                None,
                windows::Win32::System::Com::COINIT_MULTITHREADED,
            ).ok();
        }

        let init_result = (|| -> Result<_> {
            let device = match device_id {
                Some(ref id) => match find_device_by_id(&Direction::Render, id) {
                    Some(d) => d,
                    None => {
                        eprintln!("[WASAPI] Device '{}' not found, using default", id);
                        get_default_device(&Direction::Render).map_err(|e| anyhow::anyhow!("{}", e))?
                    }
                },
                None => get_default_device(&Direction::Render).map_err(|e| anyhow::anyhow!("{}", e))?,
            };

            let dev_name = device.get_friendlyname().unwrap_or_default();
            eprintln!("[WASAPI] Using render device: {}", dev_name);

            let mut audio_client = device.get_iaudioclient().map_err(|e| anyhow::anyhow!("{}", e))?;

            // CRITICAL: Use device's native mix format for loopback
            // Don't try to force mono - WASAPI loopback requires the device's own format
            let mix_format = audio_client.get_mixformat().map_err(|e| anyhow::anyhow!("{}", e))?;
            let actual_rate = mix_format.get_samplespersec();
            let channels = mix_format.get_nchannels() as u32;
            let blockalign = mix_format.get_blockalign() as usize;
            let bits = mix_format.get_bitspersample();

            eprintln!("[WASAPI] Device format: {}Hz, {} channels, {} bits, blockalign={}",
                actual_rate, channels, bits, blockalign);

            let (_def_time, min_time) = audio_client.get_periods().map_err(|e| anyhow::anyhow!("{}", e))?;

            // Initialize for loopback capture using device's native format
            // Direction::Capture on a render device = loopback mode in wasapi crate
            audio_client.initialize_client(
                &mix_format,
                min_time,
                &Direction::Capture,
                &ShareMode::Shared,
                false, // no autoconvert - use native format
            ).map_err(|e| anyhow::anyhow!("{}", e))?;

            let h_event = audio_client.set_get_eventhandle().map_err(|e| anyhow::anyhow!("{}", e))?;
            let capture_client = audio_client.get_audiocaptureclient().map_err(|e| anyhow::anyhow!("{}", e))?;
            audio_client.start_stream().map_err(|e| anyhow::anyhow!("{}", e))?;

            eprintln!("[WASAPI] Loopback capture started successfully");

            Ok((h_event, capture_client, actual_rate, channels, blockalign, bits))
        })();

        match init_result {
            Ok((h_event, capture_client, sample_rate, channels, blockalign, bits)) => {
                let _ = init_tx.send(Ok(sample_rate));
                let is_float = bits == 32;
                let bytes_per_sample = (bits / 8) as usize;

                loop {
                    {
                        let state = waker_state.lock().unwrap();
                        if state.shutdown {
                            break;
                        }
                    }

                    if h_event.wait_for_event(3000).is_err() {
                        eprintln!("[WASAPI] Timeout waiting for audio event");
                        break;
                    }

                    let mut temp_queue: VecDeque<u8> = VecDeque::new();
                    match capture_client.read_from_device_to_deque(blockalign, &mut temp_queue) {
                        Err(e) => {
                            eprintln!("[WASAPI] Read error: {}", e);
                            continue;
                        }
                        _ => {}
                    }

                    if temp_queue.is_empty() {
                        continue;
                    }

                    // Convert raw bytes to mono f32 samples
                    let frame_size = blockalign; // bytes per frame (all channels)
                    while temp_queue.len() >= frame_size {
                        // Extract one frame (all channels)
                        let mut frame_bytes: Vec<u8> = Vec::with_capacity(frame_size);
                        for _ in 0..frame_size {
                            frame_bytes.push(temp_queue.pop_front().unwrap());
                        }

                        // Mix all channels to mono
                        let mut mono_sample: f32 = 0.0;
                        for ch in 0..channels as usize {
                            let offset = ch * bytes_per_sample;
                            if offset + bytes_per_sample > frame_bytes.len() {
                                break;
                            }

                            let sample = if is_float && bytes_per_sample == 4 {
                                f32::from_le_bytes([
                                    frame_bytes[offset],
                                    frame_bytes[offset + 1],
                                    frame_bytes[offset + 2],
                                    frame_bytes[offset + 3],
                                ])
                            } else if bytes_per_sample == 2 {
                                // 16-bit PCM
                                let raw = i16::from_le_bytes([
                                    frame_bytes[offset],
                                    frame_bytes[offset + 1],
                                ]);
                                raw as f32 / 32768.0
                            } else if bytes_per_sample == 4 {
                                // 32-bit int PCM
                                let raw = i32::from_le_bytes([
                                    frame_bytes[offset],
                                    frame_bytes[offset + 1],
                                    frame_bytes[offset + 2],
                                    frame_bytes[offset + 3],
                                ]);
                                raw as f32 / 2147483648.0
                            } else {
                                0.0
                            };

                            mono_sample += sample;
                        }

                        // Average across channels
                        if channels > 0 {
                            mono_sample /= channels as f32;
                        }

                        let _ = producer.try_push(mono_sample);
                    }
                }
            }
            Err(e) => {
                let _ = init_tx.send(Err(e));
            }
        }
        Ok(())
    }
}

// Implement Drop to stop the thread
impl Drop for SpeakerStream {
    fn drop(&mut self) {
        if let Ok(mut state) = self.waker_state.lock() {
            state.shutdown = true;
        }
        if let Some(handle) = self.capture_thread.take() {
             let _ = handle.join();
        }
    }
}
