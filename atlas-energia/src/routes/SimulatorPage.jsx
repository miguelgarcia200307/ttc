import React, { useState, useEffect } from 'react';
import SectionTitle from '../components/common/SectionTitle';
import Button from '../components/common/Button';
import { getDepartmentAggregates, getMunicipiosByDepartamento, getDepartmentRecommendation } from '../data/predictions-by-region';

const SimulatorPage = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [systemCapacity, setSystemCapacity] = useState(100); // kW
  const [investmentBudget, setInvestmentBudget] = useState(200000000); // COP
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await getDepartmentAggregates();
        setDepartments(depts.sort((a, b) => a.departamento.localeCompare(b.departamento)));
      } catch (error) {
        console.error('Error cargando departamentos:', error);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const loadMunicipios = async () => {
      if (!selectedDepartment) {
        setMunicipios([]);
        setSelectedMunicipio('');
        return;
      }
      
      try {
        const munics = await getMunicipiosByDepartamento(selectedDepartment);
        setMunicipios(munics.sort((a, b) => a.municipio.localeCompare(b.municipio)));
        setSelectedMunicipio('');
      } catch (error) {
        console.error('Error cargando municipios:', error);
      }
    };
    loadMunicipios();
  }, [selectedDepartment]);

  const runSimulation = async () => {
    if (!selectedMunicipio || !systemCapacity) return;
    
    setLoading(true);
    try {
      const municipio = municipios.find(m => m.codigo_dane_municipio === parseInt(selectedMunicipio));
      if (!municipio) return;

      // Simular análisis basado en los datos del modelo
      const recommendation = await getDepartmentRecommendation(selectedDepartment);
      
      // Calcular métricas simuladas
      const baseProduction = calculateEnergyProduction(municipio, systemCapacity);
      const economicAnalysis = calculateEconomics(baseProduction, investmentBudget);
      
      setResults({
        municipio,
        production: baseProduction,
        economics: economicAnalysis,
        recommendation,
        riskFactors: getRiskFactors(municipio)
      });
    } catch (error) {
      console.error('Error en simulación:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEnergyProduction = (municipio, capacity) => {
    const solarProb = municipio.prob_solar || 0;
    const eolicaProb = municipio.prob_eolica || 0;
    const hibridaProb = municipio.prob_hibrida || 0;
    
    // Producción anual estimada (kWh/año)
    let annualProduction = 0;
    
    if (municipio.predicted_class === 'solar') {
      annualProduction = capacity * 1500 * solarProb; // Factor solar promedio Colombia
    } else if (municipio.predicted_class === 'eolica') {
      annualProduction = capacity * 2200 * eolicaProb; // Factor eólico
    } else {
      annualProduction = capacity * 1850 * hibridaProb; // Factor híbrido
    }
    
    return {
      annual: Math.round(annualProduction),
      monthly: Math.round(annualProduction / 12),
      factor: municipio.predicted_class === 'eolica' ? 2200 : 
              municipio.predicted_class === 'solar' ? 1500 : 1850,
      efficiency: Math.max(solarProb, eolicaProb, hibridaProb)
    };
  };

  const calculateEconomics = (production, investment) => {
    const energyPrice = 600; // COP/kWh promedio
    const annualRevenue = production.annual * energyPrice;
    const paybackPeriod = investment / annualRevenue;
    const npv20 = calculateNPV(annualRevenue, investment, 0.12, 20);
    
    return {
      annualRevenue: Math.round(annualRevenue),
      paybackPeriod: paybackPeriod.toFixed(1),
      npv20: Math.round(npv20),
      irr: ((annualRevenue / investment) * 100).toFixed(1)
    };
  };

  const calculateNPV = (annualCashFlow, initialInvestment, discountRate, years) => {
    let npv = -initialInvestment;
    for (let year = 1; year <= years; year++) {
      npv += annualCashFlow / Math.pow(1 + discountRate, year);
    }
    return npv;
  };

  const getRiskFactors = (municipio) => {
    const factors = [];
    
    if (municipio.tipo_red === 'ZNI') {
      factors.push('⚠️ Zona No Interconectada - Requiere sistemas de almacenamiento');
    }
    
    if (municipio.predicted_class === 'eolica' && municipio.prob_eolica < 0.7) {
      factors.push('⚡ Potencial eólico moderado - Considerar backup');
    }
    
    if (municipio.predicted_class === 'solar' && municipio.prob_solar < 0.8) {
      factors.push('☁️ Variabilidad solar - Planificar almacenamiento');
    }
    
    return factors;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container-width section-padding">
        <div className="text-center mb-10">
          <SectionTitle 
            title="Simulador de Inversión Energética"
            subtitle="Evalúa la viabilidad técnica y económica de proyectos de energía renovable"
          />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Panel de configuración */}
            <div className="bg-main-dark rounded-2xl p-6 text-white">
              <h3 className="text-xl font-semibold mb-6">Configuración del Proyecto</h3>
              
              <div className="space-y-6">
                {/* Selección de departamento */}
                <div>
                  <label className="block text-sm font-medium mb-2">Departamento</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="">Seleccionar departamento</option>
                    {departments.map(dept => (
                      <option key={dept.departamento} value={dept.departamento} className="text-gray-900">
                        {dept.departamento}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selección de municipio */}
                <div>
                  <label className="block text-sm font-medium mb-2">Municipio</label>
                  <select
                    value={selectedMunicipio}
                    onChange={(e) => setSelectedMunicipio(e.target.value)}
                    disabled={!selectedDepartment}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  >
                    <option value="">Seleccionar municipio</option>
                    {municipios.map(mun => (
                      <option key={mun.codigo_dane_municipio} value={mun.codigo_dane_municipio} className="text-gray-900">
                        {mun.municipio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Capacidad del sistema */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Capacidad del Sistema: {systemCapacity} kW
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step="10"
                    value={systemCapacity}
                    onChange={(e) => setSystemCapacity(parseInt(e.target.value))}
                    className="w-full accent-accent-green"
                  />
                </div>

                {/* Presupuesto de inversión */}
                <div>
                  <label className="block text-sm font-medium mb-2">Presupuesto de Inversión (COP)</label>
                  <input
                    type="number"
                    value={investmentBudget}
                    onChange={(e) => setInvestmentBudget(parseInt(e.target.value))}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                    step="1000000"
                  />
                </div>

                {/* Botón de simulación */}
                <Button
                  onClick={runSimulation}
                  disabled={!selectedMunicipio || loading}
                  className="w-full"
                >
                  {loading ? 'Simulando...' : 'Ejecutar Simulación'}
                </Button>
              </div>
            </div>

            {/* Panel de resultados */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-6 text-main-dark">Resultados de la Simulación</h3>
              
              {!results ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-4xl mb-4">📊</div>
                  <p>Configura los parámetros y ejecuta la simulación para ver los resultados</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Información del municipio */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-main-dark mb-2">Ubicación Seleccionada</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Municipio:</strong> {results.municipio.municipio}</div>
                      <div><strong>Departamento:</strong> {results.municipio.departamento}</div>
                      <div><strong>Tipo de Red:</strong> {results.municipio.tipo_red}</div>
                      <div className="capitalize"><strong>Potencial Dominante:</strong> {results.municipio.predicted_class}</div>
                    </div>
                  </div>

                  {/* Producción de energía */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-main-dark mb-2">Producción Estimada</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Anual</div>
                        <div className="text-lg font-semibold">{results.production.annual.toLocaleString()} kWh</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Mensual</div>
                        <div className="text-lg font-semibold">{results.production.monthly.toLocaleString()} kWh</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Factor de Planta</div>
                        <div className="text-lg font-semibold">{results.production.factor} h/año</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Eficiencia</div>
                        <div className="text-lg font-semibold">{(results.production.efficiency * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Análisis económico */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-main-dark mb-2">Análisis Económico</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Ingresos Anuales</div>
                        <div className="text-lg font-semibold text-green-600">
                          ${results.economics.annualRevenue.toLocaleString()} COP
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">Tiempo de Recuperación</div>
                        <div className="text-lg font-semibold">{results.economics.paybackPeriod} años</div>
                      </div>
                      <div>
                        <div className="text-gray-600">VPN (20 años)</div>
                        <div className={`text-lg font-semibold ${results.economics.npv20 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${results.economics.npv20.toLocaleString()} COP
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">IRR</div>
                        <div className="text-lg font-semibold">{results.economics.irr}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendaciones y riesgos */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-main-dark mb-2">Recomendaciones</h4>
                    <div className="text-sm text-gray-700 mb-3">{results.recommendation}</div>
                    
                    {results.riskFactors.length > 0 && (
                      <div>
                        <h5 className="font-medium text-main-dark mb-1">Consideraciones:</h5>
                        <div className="space-y-1">
                          {results.riskFactors.map((factor, index) => (
                            <div key={index} className="text-sm text-orange-700">{factor}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatorPage;