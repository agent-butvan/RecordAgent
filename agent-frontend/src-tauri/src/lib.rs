#[cfg(desktop)]
mod backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      #[cfg(desktop)]
      if !cfg!(debug_assertions) {
        backend::setup(app.handle())?;
      }
      Ok(())
    });

  #[cfg(desktop)]
  let builder = builder.invoke_handler(tauri::generate_handler![
    backend::get_backend_mode,
    backend::get_backend_port
  ]);

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::Exit = event {
      #[cfg(desktop)]
      backend::shutdown(app_handle);
    }
  });
}
