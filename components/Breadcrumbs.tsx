"use client"

export default function Breadcrumbs({ path, onNavigate }: any) {

  return (
    <div className="mb-4">

      <span
        className="link"
        onClick={() => onNavigate([])}
      >
        Root
      </span>

      {path.map((p: any, index: number) => (
        <span key={p.id}>
          {" / "}
          <span
            className="link"
            onClick={() => onNavigate(path.slice(0, index + 1))}
          >
            {p.name}
          </span>
        </span>
      ))}

    </div>
  )
}