import {
  formulaFilterMethods,
  type IFormulaFilterValue,
  type TExtendedFormulaFilterValue,
} from "../../filtration";
import { EClickHouseBaseTypes } from "../../clickHouseTypes";
import { mapFormulaFilterToCalculatorInput } from "./mapFormulaFiltersToInputs";

describe("Тест mapFormulaFilterToCalculatorInput", () => {
  describe("IN_RANGE/NOT_IN_RANGE больше не подменяют целочисленный dbDataType на Float64", () => {
    // BI-15425: блок подмены INTEGER → Float64 удалён из mapFormulaFilterToCalculatorInput.
    // Правило выбора типа каста теперь единое и живёт в потребителе —
    // Calculator.prepareFilters (packages/bi-data/src/calculators/calculator.ts).
    // Подмена здесь искажала ICalculatorFilter.dbDataType для ВСЕХ потребителей маппера
    // (не только Calculator.prepareFilters) и тихо отключала точный каст UInt128 из
    // BI-14465 в режиме диапазона. Кейсы ниже — гвард на то, что подмена не вернётся.
    it.each([
      [formulaFilterMethods.IN_RANGE, EClickHouseBaseTypes.Int64],
      [formulaFilterMethods.IN_RANGE, EClickHouseBaseTypes.UInt64],
      [formulaFilterMethods.NOT_IN_RANGE, EClickHouseBaseTypes.Int64],
      [formulaFilterMethods.NOT_IN_RANGE, EClickHouseBaseTypes.UInt64],
    ])("%s + %s: dbDataType остаётся исходным", (filteringMethod, dbDataType) => {
      const filterValue: IFormulaFilterValue = {
        formula: `"table"."column"`,
        dbDataType,
        filteringMethod,
        checkedValues: ["-5", "2"],
      };

      const result = mapFormulaFilterToCalculatorInput(filterValue);

      expect(result?.dbDataType).toBe(dbDataType);
    });
  });

  // Блок sliceIndex (mapFormulaFiltersToInputs.ts:215-224) в BI-15425 не менялся —
  // кейс фиксирует, что он остался цел.
  it("sliceIndex с Array(UInt64) даёт плоский UInt64 и формулу вида (formula)[index]", () => {
    const filterValue: IFormulaFilterValue = {
      formula: `"table"."values"`,
      dbDataType: "Array(UInt64)",
      sliceIndex: 2,
      filteringMethod: formulaFilterMethods.EQUAL_TO,
      checkedValues: ["42"],
    };

    const result = mapFormulaFilterToCalculatorInput(filterValue);

    expect(result?.dbDataType).toBe(EClickHouseBaseTypes.UInt64);
    expect(result?.formula).toBe(`("table"."values")[2]`);
  });

  it("для не-formula-фильтра возвращает dbDataType: Bool, values: ['true'], filteringMethod: EQUAL_TO", () => {
    const filterValue: TExtendedFormulaFilterValue = {
      formula: `"table"."flag" > 0`,
    };

    const result = mapFormulaFilterToCalculatorInput(filterValue);

    expect(result?.dbDataType).toBe(EClickHouseBaseTypes.Bool);
    expect(result?.values).toEqual(["true"]);
    expect(result?.filteringMethod).toBe(formulaFilterMethods.EQUAL_TO);
  });
});
