using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CcmsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentTypeToCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "payment_type",
                table: "ccms_coverage_cases",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "payment_type",
                table: "ccms_coverage_cases");
        }
    }
}
