/* Public browser configuration only. Never put a service_role key in this file. */
(function(){
  var config={url:'https://uqdltavtshndprtkzzay.supabase.co',publishableKey:'sb_publishable_M8XE8vmEr2XyYpXQNwd1Uw_kK_U1jV0'};
  if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('Supabase JS client is not loaded');
  window.fishgrowSupabase=window.supabase.createClient(config.url,config.publishableKey);
})();


