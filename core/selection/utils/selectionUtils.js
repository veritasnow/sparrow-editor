export function findParentTdFromTable(table) {

    let current = table.parentElement;

    while (current) {

        if (
            current.classList &&
            current.classList.contains('se-table-cell')
        ) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
}

export function findParentTableFromTd(td) {

    if (!td) {
        return null;
    }

    let current = td.parentElement;

    while (current) {

        // 자기 내부 table 제외
        const table = current.closest?.('.se-table');

        if (table && !td.contains(table)) {
            return table;
        }

        current = current.parentElement;
    }

    return null;
}