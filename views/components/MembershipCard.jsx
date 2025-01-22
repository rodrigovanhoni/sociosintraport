import React, { useState } from "react";
import { Camera } from "lucide-react";

const MembershipCard = ({
  name = "João da Silva",
  memberNumber = "12345",
  cpf = "123.456.789-00",
  issueDate = "16/01/2025",
  validUntil = "16/01/2026",
  photo = null,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const generatePDF = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${baseUrl}/api/generate-card`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          memberNumber,
          cpf,
          issueDate,
          validUntil,
          photo,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar PDF");
      }

      // Criar blob do PDF
      const blob = await response.blob();

      // Criar URL do blob
      const url = window.URL.createObjectURL(blob);

      // Criar link para download
      const a = document.createElement("a");
      a.href = url;
      a.download = "carteirinha.pdf";
      document.body.appendChild(a);
      a.click();

      // Limpar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao gerar carteirinha");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Preview da carteirinha */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-600">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-blue-600">
              Nome do Sindicato
            </h2>
            <p className="text-sm text-gray-600">
              Carteira de Identificação do Sócio
            </p>
          </div>
          <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center">
            {photo ? (
              <img
                src={photo}
                alt="Foto do sócio"
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <Camera className="w-12 h-12 text-gray-400" />
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <p className="text-sm text-gray-600">Nome</p>
            <p className="font-semibold">{name}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-sm text-gray-600">Nº de Sócio</p>
              <p className="font-semibold">{memberNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="font-semibold">{cpf}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-sm text-gray-600">Data de Emissão</p>
              <p className="font-semibold">{issueDate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Válido até</p>
              <p className="font-semibold">{validUntil}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="text-xs text-gray-500 text-center">
            Esta carteira é de uso pessoal e intransferível
          </p>
        </div>
      </div>

      {/* Botão de geração do PDF */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={generatePDF}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isLoading ? "Gerando PDF..." : "Gerar Carteirinha (PDF)"}
        </button>
      </div>
    </div>
  );
};

export default MembershipCard;
