-- Pin the search path of the updated_at trigger function (Supabase security advisor: function_search_path_mutable).
alter function store.touch() set search_path = '';
