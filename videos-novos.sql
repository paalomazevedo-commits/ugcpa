/* ============================================================
   VÍDEOS NOVOS DO PORTFÓLIO
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isto faz: adiciona os 17 vídeos que você mandou, já
   organizados nos 5 grupos que você separou (Beleza, Moda,
   Marketplace, Youtube Ads e Experiências). Cada um nasce com
   visivel = true, então aparece no site assim que você rodar.

   Se quiser mudar o título, a marca, o destaque (ex: "2,4M views")
   ou esconder algum, é mais fácil fazer depois pelo seu painel
   (admin/index.html, aba Portfólio) do que editando este arquivo
   de novo.
   ============================================================ */

insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel) values
  -- Beleza
  ('Batom',            'https://youtube.com/shorts/Q1XgR8XCRDo', 'beleza', 'vídeo UGC 9:16', 'Aprilskin',        '', 1,  true),
  ('Hidratante',        'https://youtube.com/shorts/e4SqXe4NIT4', 'beleza', 'vídeo UGC 9:16', 'Garnier',          '', 2,  true),
  ('Máscara facial',    'https://youtube.com/shorts/YfBW8uTd_FE', 'beleza', 'vídeo UGC 9:16', 'Celimax',          '', 3,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/5fRyCAOh6w0', 'beleza', 'vídeo UGC 9:16', 'Pantene',          '', 4,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/3uP9Y_XuXDs', 'beleza', 'vídeo UGC 9:16', 'Meditherapy',      '', 5,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/Zyl-CJ87DD0', 'beleza', 'vídeo UGC 9:16', 'Elseve',           '', 6,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/YZVOHRcJfO8', 'beleza', 'vídeo UGC 9:16', 'Elseve',           '', 7,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/0GcntsqYA44', 'beleza', 'vídeo UGC 9:16', 'Garnier',          '', 8,  true),
  ('Vídeo UGC',         'https://youtube.com/shorts/sJdG9eBBj0I', 'beleza', 'vídeo UGC 9:16', 'Perfumaria',       '', 9,  true),
  ('Escova rotativa',   'https://youtube.com/shorts/7xDt2jX4qKc', 'beleza', 'vídeo UGC 9:16', 'Escova Rotativa',  '', 10, true),

  -- Moda
  ('Vídeo UGC',         'https://youtube.com/shorts/5HXMmzM6_lc', 'moda', 'vídeo UGC 9:16', 'Byri', '', 1, true),
  ('Vídeo UGC',         'https://youtube.com/shorts/oHQP-hHP4jo', 'moda', 'vídeo UGC 9:16', 'Byri', '', 2, true),

  -- Marketplace
  ('Vídeo UGC',         'https://youtube.com/shorts/otyeKDejMJA', 'marketplace', 'vídeo UGC 9:16', 'Mercado Livre', '', 1, true),

  -- Youtube Ads
  ('Anúncio em vídeo',  'https://youtu.be/jAowcJkJrJg', 'youtube ads', 'vídeo 16:9', 'Synpay Soluções', '', 1, true),

  -- Experiências
  ('Vídeo UGC',         'https://youtube.com/shorts/it3V6P8OLfA', 'experiências', 'vídeo UGC 9:16', 'Beauty', '', 1, true),
  ('Vídeo UGC',         'https://youtube.com/shorts/6XLvRDHH6rc', 'experiências', 'vídeo UGC 9:16', 'Beauty', '', 2, true),
  ('Experiência gravada','https://youtube.com/shorts/zSPzNQx0aR8', 'experiências', 'vídeo UGC 9:16', 'Hamburgueria', '', 3, true);
