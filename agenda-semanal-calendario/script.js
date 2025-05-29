// 🌙 Tema escuro/claro
function aplicarTema() {
  const tema = localStorage.getItem("tema") || "claro";
  document.body.className = tema;
}
function alternarTema() {
  const novoTema = document.body.className === "escuro" ? "claro" : "escuro";
  document.body.className = novoTema;
  localStorage.setItem("tema", novoTema);
}
aplicarTema();

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let tarefas = [];
let dataAtual = new Date();
let mostrarSomenteFavoritas = false; // NOVO: controla filtro de favoritas

function formatarData(data) {
  return data.toISOString().split('T')[0];
}

// 👉 NOVA FUNÇÃO PARA FORMATO BRASILEIRO
function formatarDataBR(data) {
  if (typeof data === "string") data = new Date(data);
  return data.toLocaleDateString('pt-BR');
}

function atualizarSemana() {
  const inicio = new Date(dataAtual);
  inicio.setDate(inicio.getDate() - inicio.getDay());

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  // EXIBE O INTERVALO NO FORMATO BRASILEIRO
  document.getElementById("semana-atual").textContent =
    `${formatarDataBR(inicio)} até ${formatarDataBR(fim)}`;

  exibirTarefas();
}

window.alterarSemana = function (direcao) {
  dataAtual.setDate(dataAtual.getDate() + (7 * direcao));
  atualizarSemana();
};

function getDataPorDiaSemana(nomeDia) {
  const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const index = dias.indexOf(nomeDia);
  const inicio = new Date(dataAtual);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  inicio.setDate(inicio.getDate() + index);
  return formatarData(inicio);
}

// 🔔 Checar se data já passou
function dataEhPassada(dataStr) {
  const hoje = new Date();
  hoje.setHours(0,0,0,0); // Zera horas para comparar só data
  const data = new Date(dataStr + "T00:00:00");
  return data < hoje;
}

// ABRIR MODAL PARA NOVA TAREFA
window.abrirModal = function (dia) {
  document.getElementById("modalTarefa").style.display = "flex";
  document.getElementById("dia").value = dia;
  document.getElementById("data").value = getDataPorDiaSemana(dia);

  const form = document.getElementById("formTarefa");
  // Remove qualquer evento anterior
  form.onsubmit = null;
  // Definir submit para criar nova tarefa
  form.onsubmit = async (e) => {
    e.preventDefault();
    const nova = obterDadosFormulario();
    if (dataEhPassada(nova.data)) {
      const confirma = confirm("A data escolhida já passou. Tem certeza que deseja adicionar a tarefa mesmo assim?");
      if (!confirma) return;
    }
    await addDoc(collection(window.db, "tarefas"), nova);
    fecharModal();
    exibirTarefas();
  };
};

// FECHAR MODAL (sempre remove eventos)
window.fecharModal = function () {
  document.getElementById("modalTarefa").style.display = "none";
  document.getElementById("formTarefa").reset();
  document.getElementById("formTarefa").onsubmit = null;
};

function limparAgenda() {
  const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  dias.forEach(dia => {
    const coluna = document.getElementById(dia);
    coluna.querySelectorAll(".tarefa").forEach(el => el.remove());
  });
}

function getInicioFimSemana() {
  const inicio = new Date(dataAtual);
  inicio.setDate(inicio.getDate() - inicio.getDay());

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  return [formatarData(inicio), formatarData(fim)];
}

async function exibirTarefas() {
  if (!window.db || !window.auth) return;

  limparAgenda();
  const user = window.auth.currentUser;
  if (!user) return;

  const [inicio, fim] = getInicioFimSemana();
  const ref = collection(window.db, "tarefas");
  const q = query(ref, where("uid", "==", user.uid));
  const snapshot = await getDocs(q);

  tarefas = [];
  snapshot.forEach(docSnap => {
    const tarefa = docSnap.data();
    tarefa.id = docSnap.id;
    tarefas.push(tarefa);
  });

  // NOVO: filtra favoritas se estiver ativo
  tarefas.forEach(t => {
    if (mostrarSomenteFavoritas && !t.favorita) return;
    const dataTarefa = new Date(t.data);
    if (
      (t.data >= inicio && t.data <= fim) ||
      (t.recorrencia === "semanal" && isDentroDaSemana(dataTarefa, inicio, fim, 7)) ||
      (t.recorrencia === "mensal" && isDentroDaSemana(dataTarefa, inicio, fim, 30))
    ) {
      adicionarNaTela(t);
    }
  });
  atualizarRelatorio();
}

function isDentroDaSemana(origem, inicio, fim, intervaloDias) {
  const proxOcorrencia = new Date(origem);
  while (proxOcorrencia <= new Date(fim)) {
    if (proxOcorrencia >= new Date(inicio)) return true;
    proxOcorrencia.setDate(proxOcorrencia.getDate() + intervaloDias);
  }
  return false;
}

function getNomeDiaSemana(dataStr) {
  const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const date = new Date(dataStr + "T12:00:00"); // evita bug de timezone
  return dias[date.getDay()];
}

// 👇 AGORA O CARD DA TAREFA FICA COM BORDA GROSSA E ESTRELA PRETA DENTRO DA BORDA SE FOR FAVORITO
function adicionarNaTela(tarefa) {
  const diaSemana = getNomeDiaSemana(tarefa.data);
  const container = document.getElementById(diaSemana);
  if (!container) return;
  const div = document.createElement("div");
  div.className = `tarefa ${tarefa.prioridade}${tarefa.favorita ? ' favorita' : ''}`;
  div.innerHTML = `
    ${tarefa.favorita ? `<span class="estrela-borda">★</span>` : ''}
    <strong>${tarefa.hora} - ${tarefa.titulo}</strong><br>
    ${tarefa.descricao}<br>
    ${formatarDataBR(tarefa.data)}<br>
    <div class="acoes">
      <button onclick="favoritarTarefa('${tarefa.id}')">${tarefa.favorita ? "★" : "☆"}</button>
      <button onclick="editarTarefa('${tarefa.id}')">✎</button>
      <button onclick="removerTarefa('${tarefa.id}')">🗑️</button>
    </div>
  `;
  container.appendChild(div);
}

window.removerTarefa = async function (id) {
  await deleteDoc(doc(window.db, "tarefas", id));
  exibirTarefas();
};

// ABRIR MODAL PARA EDIÇÃO DE TAREFA
window.editarTarefa = function (id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;
  abrirModal(tarefa.dia);

  document.getElementById("titulo").value = tarefa.titulo;
  document.getElementById("descricao").value = tarefa.descricao;
  document.getElementById("hora").value = tarefa.hora;
  document.getElementById("dia").value = tarefa.dia;
  document.getElementById("data").value = tarefa.data;
  document.getElementById("prioridade").value = tarefa.prioridade || "media";
  document.getElementById("recorrencia").value = tarefa.recorrencia || "nenhuma";

  const form = document.getElementById("formTarefa");
  // Remove qualquer evento anterior
  form.onsubmit = null;
  // Definir submit para atualizar tarefa existente
  form.onsubmit = async (e) => {
    e.preventDefault();
    const atualizada = obterDadosFormulario();
    if (dataEhPassada(atualizada.data)) {
      const confirma = confirm("A data escolhida já passou. Tem certeza que deseja salvar a tarefa mesmo assim?");
      if (!confirma) return;
    }
    await updateDoc(doc(window.db, "tarefas", id), atualizada);
    fecharModal();
    exibirTarefas();
  };
};

function obterDadosFormulario() {
  const user = window.auth?.currentUser;
  if (!user) {
    alert("Usuário não autenticado.");
    throw new Error("Usuário não autenticado.");
  }

  return {
    titulo: document.getElementById("titulo").value,
    descricao: document.getElementById("descricao").value,
    hora: document.getElementById("hora").value,
    dia: document.getElementById("dia").value,
    data: document.getElementById("data").value,
    prioridade: document.getElementById("prioridade").value,
    recorrencia: document.getElementById("recorrencia").value,
    uid: user.uid,
    favorita: false // por padrão, tarefas novas não são favoritas
  };
}

// NÃO PRECISA MAIS DO SUBMIT GLOBAL
// document.getElementById("formTarefa").addEventListener("submit", ...);

window.imprimirAgenda = function () {
  window.print();
};

window.favoritarTarefa = async function (id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;
  tarefa.favorita = !tarefa.favorita;
  await updateDoc(doc(window.db, "tarefas", id), { favorita: tarefa.favorita });
  exibirTarefas();
};

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
const auth = getAuth();
window.auth = auth;

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.db = window.db || window.firebaseDb;
    atualizarSemana();
  } else {
    window.location.href = "login.html";
  }
});

window.aplicarTema = aplicarTema;
window.alternarTema = alternarTema;

// 🔍 Filtro
window.filtrarTarefas = async function () {
  const termo = document.getElementById("filtro").value.toLowerCase().trim();
  if (!window.db || !window.auth) return;

  limparAgenda();

  const user = window.auth.currentUser;
  if (!user) return;

  const ref = collection(window.db, "tarefas");
  const q = query(ref, where("uid", "==", user.uid));
  const snapshot = await getDocs(q);

  tarefas = [];
  snapshot.forEach(docSnap => {
    const tarefa = docSnap.data();
    tarefa.id = docSnap.id;
    tarefas.push(tarefa);
  });

  if (termo === "") {
    atualizarSemana();
    return;
  }

  const resultados = tarefas.filter(tarefa => {
    const conteudo = `${tarefa.titulo} ${tarefa.descricao} ${tarefa.data} ${tarefa.hora}`.toLowerCase();
    return conteudo.includes(termo);
  });

  if (resultados.length === 0) {
    document.getElementById("semana-atual").textContent = "Nenhuma tarefa encontrada.";
    return;
  }

  const datas = resultados.map(t => new Date(t.data));
  const dataMin = new Date(Math.min(...datas));
  const dataMax = new Date(Math.max(...datas));
  const intervalo = `Resultados: ${formatarDataBR(dataMin)} até ${formatarDataBR(dataMax)}`;
  document.getElementById("semana-atual").textContent = intervalo;

  resultados.forEach(adicionarNaTela);
};

// NOVO: função para ativar/desativar filtro de favoritas
window.toggleFavoritas = function () {
  mostrarSomenteFavoritas = !mostrarSomenteFavoritas;
  const btn = document.getElementById("filtroFavoritas");
  btn.textContent = mostrarSomenteFavoritas ? "Todas" : "Favoritos";
  exibirTarefas();
};

let grafico = null;

function atualizarRelatorio() {
  const [inicio, fim] = getInicioFimSemana();
  const tarefasSemana = tarefas.filter(t => {
    const data = new Date(t.data);
    return (
      (t.data >= inicio && t.data <= fim) ||
      (t.recorrencia === "semanal" && isDentroDaSemana(data, inicio, fim, 7)) ||
      (t.recorrencia === "mensal" && isDentroDaSemana(data, inicio, fim, 30))
    );
  });

  const contagem = { alta: 0, media: 0, baixa: 0 };
  tarefasSemana.forEach(t => {
    contagem[t.prioridade] = (contagem[t.prioridade] || 0) + 1;
  });

  const total = tarefasSemana.length;
  document.getElementById("totalTarefas").textContent = `Total de tarefas nesta semana: ${total}`;

  const ctx = document.getElementById("graficoPrioridade").getContext("2d");
  if (grafico) grafico.destroy();
  grafico = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Alta', 'Média', 'Baixa'],
      datasets: [{
        data: [contagem.alta, contagem.media, contagem.baixa],
        backgroundColor: ['#d32f2f', '#fbc02d', '#388e3c']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}
