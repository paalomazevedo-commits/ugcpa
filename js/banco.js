/* ============================================================
   LIGAÇÃO COM O BANCO (Supabase)
   Este é o ÚNICO lugar do projeto com o endereço do projeto e a
   chave pública. Se um dia precisar trocar, troca só aqui.

   A chave abaixo é a chave PÚBLICA (publishable/anon). Ela é
   feita pra ficar visível no código do navegador, então não tem
   problema nenhum ela aparecer aqui. O que protege os seus dados
   de verdade é a tranca no banco (RLS), lá no Supabase, não o
   segredo dessa chave. NUNCA coloque a chave secreta (service
   role) em nenhum arquivo deste site.

   COMO USAR: em qualquer página que precisar do banco, coloque
   estas duas tags, NESTA ORDEM, antes do seu próprio script:

   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="../js/banco.js"></script>   (ajuste o caminho conforme a pasta da página)

   Depois disso, use window.banco em qualquer lugar, por exemplo:
   window.banco.from("videos").select("*")
   ============================================================ */
(function () {
  var URL_PROJETO = "https://hfoydkgetdbmluxakceb.supabase.co";
  var CHAVE_PUBLICA = "sb_publishable_uJVybmso80zYDshNq23TIA_apfPGMd-";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error(
      "js/banco.js: a biblioteca do Supabase não carregou. " +
      "Confira se a tag <script> do CDN vem ANTES da tag deste arquivo."
    );
    window.banco = null;
    return;
  }

  window.banco = window.supabase.createClient(URL_PROJETO, CHAVE_PUBLICA);
})();
