/* Public browser configuration only. Never put a service_role key in this file. */
(function () {
  var config = {
    url: 'https://uqdltavtshndprtkzzay.supabase.co',
    publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZGx0YXZ0c2huZHBydGt6emF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDQ4ODMsImV4cCI6MjEwNjc4MDg4M30.ChkQbIHpbiTubPErqcJqHKRQt80vGemfAACkPCT9NWg'
  };
  if (!window.supabase || typeof window.supabase.createClient !== 'function') throw new Error('Supabase JS client is not loaded');
  window.fishgrowSupabase = window.supabase.createClient(config.url, config.publishableKey);
})();
